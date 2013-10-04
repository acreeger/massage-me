//TODO: There is a slight bug: When a new page is created and activated, the non-admin clients are taken to the new page, with no time slots
//This isn't a major issue, a refresh fixes it, and only happens when the admin and client are viewing at exactly the same time, which isn't likely given our
//use cases.

if (Meteor.isClient) {
  var TIMEZONE = "America/Los_Angeles";

  var isAdmin = null;
  var adminDependency = new Deps.Dependency

  function getIsAdmin() {
    adminDependency.depend()
    return isAdmin;
  }

  function setIsAdmin(value) {
    if (isAdmin !== value) {
      isAdmin = value;
      adminDependency.changed()
    }
  }

  Meteor.startup(function () {
    Meteor.call("isAdmin", document.location.pathname, document.location.search, function(err, result) {
      if (err) {
        console.log("Error occured whilst checking admin:", err)
      } else {
        setIsAdmin(result);
        var daysSubscription = Meteor.subscribe("daysAndTimeSlots", function() {
          Deps.autorun(function() {
            var latestDay = Days.findOne({active:true}, {sort:{dayTimestamp : -1}})
            var foundDay = !!latestDay;

            if (!foundDay && getIsAdmin()) {
              latestDay = Days.findOne({}, {sort:{dayTimestamp : -1}})
            }

            if (latestDay) {
              console.log("Client init: Found a day (%s, active: %s). Setting currentDayId in session", moment(latestDay.dayTimestamp).tz(TIMEZONE).format("MM/DD/YYYY"), latestDay.active);
              Session.set("currentDayId", latestDay._id);
              Session.set("loaded", true);
            } else {
              console.log("Client init: Did not find an active day.")
            }
          })
        });
      }
    });
  });

  // Template.hello.events({
  //   'click input' : function () {
  //     // template data, if any, is available in 'this'
  //     if (typeof console !== 'undefined')
  //       console.log("You pressed the button");
  //   }
  // });

  // # Partials with parameters!
  // # Thanks to http://zachsnow.com/#!/blog/2012/handlebarsjs/
  // from: https://gist.github.com/dmayo3/3475017

  Handlebars.registerHelper("partial", function(template, options) {
    // # Find the partial in question.
    var partial = Template[template]

    // # Extend the current context
    var context = _.extend({}, this, options.hash);

    // # Render, marked as safe so it isn't escaped.
    return new Handlebars.SafeString(partial(context))
  });

  Handlebars.registerHelper("loaded", function() {
    return Session.get("loaded");
  });

  Handlebars.registerHelper("isAdmin", getIsAdmin);

  Template.masseuseHeader.masseuseName = function(masseuseNumber) {
    var day = Days.findOne(Session.get("currentDayId"));
    var result = "";

    if (day) {
      var key = "masseuse" + masseuseNumber;

      if (day[key]) {
        result = day[key].name;
      }
    }

    return result;
  }

  Template.massageTable.date = function() {
    var day;
    var dayId = Session.get("currentDayId");
    if (dayId) {
      day = Days.findOne(dayId);
    }

    if (day) {
      return moment(day.dayTimestamp).tz(TIMEZONE).format('MMMM Do YYYY');
    } else {
      return "None selected" //HACK
    }
  }

  var getSlotsCursor = function() {
    var dayId = Session.get("currentDayId");

    return TimeSlots.find({dayId:dayId}, {sort: {slotTimestamp:1}});
  }

  Template.massageTable.slots = getSlotsCursor;

  Template.massageTable.currentDayIsActive = function() {
    var dayId = Session.get("currentDayId");
    if (dayId) day = Days.findOne(dayId);

    if (day) return day.active
    else return true;
  }

  Template.massageTable.hours = function() {
    var result = [];
    for (var i = 9; i <= 17; i++) {
      var text = i > 12 ? i - 12 : i
      result.push({value:i, text:text})
    }
    return result;
  }

  Template.massageTable.hoursSelected = function() {
    var firstSlot = getSlotsCursor().fetch()[0];

    if (firstSlot) {
      var time = moment(firstSlot.slotTimestamp).tz(TIMEZONE);
      return time.hours() === this.value ? "selected" : "";
    }
  }

  Template.massageTable.minutes = function() {
    var result = [];
    for (var i = 0; i < 60; i = i + 5) {
      var text = i < 10 ? "0" + i : i;
      result.push({value:i, text:text})
    }
    return result;
  }

  Template.massageTable.minutesSelected = function() {
    var firstSlot = getSlotsCursor().fetch()[0];

    var time = moment(firstSlot.slotTimestamp).tz(TIMEZONE);
    return time.minutes() === this.value ? "selected" : "";
  }

  Template.massageTable.increments = function() {
    var result = [];
    for (var i = 5; i < 60; i = i + 5) {
      result.push({value:i, text:i})
    }
    return result;
  }

  Template.massageTable.incrementsSelected = function() {
    var slots = getSlotsCursor().fetch();
    var currentIncrement;
    if (slots.length > 1) {
      currentIncrement = determineIncrement(slots[0],slots[1])
    } else {
      currentIncrement = INCREMENT;
    }

    return (currentIncrement / 60 / 1000) === this.value ? "selected" : "";
  }

  Template.massageTable.waitlist = function() {var dayId = Session.get("currentDayId");
    var day, dayId = Session.get("currentDayId");
    if (dayId) day = Days.findOne(dayId);

    if (day) {
      return  day.waitlist || [];
    }
  }

  function toggleAvailability(evt, slot, isAvailable) {
      evt.preventDefault();
      var $tgt = $(evt.target);
      var masseuse = $tgt.closest("td").attr("data-masseuse");

      var field = "masseuse" + masseuse + ".available"
      var update = {};
      update[field] = isAvailable;
      TimeSlots.update(slot._id, { $set: update});
  }

  function updateCustomerName(slot, masseuse, name) {
    if (!masseuse || masseuse === "") {
      console.log("Not updating customer name because masseuse # is not valid: '%s'",masseuse);
    } else {
      var field = "masseuse" + masseuse + ".customerName";
      var update = {};
      update[field] = name;
      TimeSlots.update(slot._id, { $set: update});
    }
  }

  function determineIncrement(slot1, slot2) {
    return Math.abs(slot1.slotTimestamp - slot2.slotTimestamp);
  }

  function addWaitlistName() {
    var name = $("#waitlist-name").val().trim();
    if (name !== "") {
      var currentDay = Days.findOne(Session.get("currentDayId"));
      Days.update(Session.get("currentDayId"), {$addToSet : {waitlist : name}});
      $("#waitlist-name").val("");
    }
  }

  Template.massageTable.events({
    'click .book-time-slot' : function(evt) {
      var $cell = $(evt.target).closest("td");
      var masseuse = $cell.attr("data-masseuse");
      var $checkbox = $cell.find("input.terms-conditions-checkbox");

      if (isAdmin || $checkbox.is(":checked")){
        var name = $cell.find("input.time-slot-input").val();

        if (name !== "") {
          updateCustomerName(this, masseuse, name);
        }
      } else {
        var $summary = $cell.find(".terms-summary")
        $summary.addClass("error");
        Meteor.setTimeout(function() {
          $summary.removeClass("error");
        },7500)
      }
    },
    'change .terms-conditions-checkbox' : function(evt) {
      var $checkbox = $(evt.target);
      var $cell = $checkbox.closest("td");

      if ($checkbox.is(":checked")) {
        $cell.find(".terms-summary").removeClass("error")
      }
    },
    'click .make-unavailable' : function(evt) {
      toggleAvailability(evt, this, false)
    },
    'click .make-available' : function(evt) {
      toggleAvailability(evt, this, true)
    },
    'click .remove-booking' : function(evt) {      
      evt.preventDefault();
      if (confirm("Are you sure you wish to remove this booking?")) {
        var $tgt = $(evt.target);
        var masseuse = $tgt.closest("td").attr("data-masseuse");

        updateCustomerName(this, masseuse, "");
      }
    },
    'click .toggle-active' : function(evt) {
      if (confirm("Are you sure? You won't be able hide this page once it is public.")) {
        var dayId = Session.get("currentDayId");
        //TODO: Change this to use Mongo toggle $toggle (or whatever it is) - this will stop the need for the findOne then update
        var day = Days.findOne(dayId);
        
        var newVal = !day.active;
        Days.update(dayId, {$set : {active: newVal}})        
      }
    },
    'click .change-masseuse-name' : function(evt) {
      evt.preventDefault();
      var $target = $(evt.target);
      $target.closest("th").addClass("editing");
    },
    'click .save-masseuse-name' : function(evt) {
      if (isAdmin) {
        evt.preventDefault();
        var $target = $(evt.target);
        var $th = $target.closest("th");
        var masseuse = $th.attr("data-masseuse");
        var newName = $th.find("input.masseuse-name").val();
        var dayId = Session.get("currentDayId")
        var currentDay = Days.findOne(dayId);
        var update = {};

        update["masseuse" + masseuse] = {name:newName};
        Days.update(dayId,{$set : update});
        $th.removeClass("editing")
      }
    },
    'click .add-timeslot' : function(evt) {
      if (isAdmin) {
        var dayId = Session.get("currentDayId");

        var latestTimeSlots = TimeSlots.find({dayId:dayId}, {sort: {slotTimestamp:-1}, limit:2}).fetch();
        if (latestTimeSlots.length > 0) {
          var increment = latestTimeSlots.length <= 1 ? INCREMENT : determineIncrement(latestTimeSlots[0], latestTimeSlots[1]);
          var newTimestamp = latestTimeSlots[0].slotTimestamp + increment;
          var ordinal = latestTimeSlots[0].ordinal + 1;
          createSlot(dayId, newTimestamp, ordinal);
        } else {
          console.log("Not doing anything because there are no timeslots");
          //TODO: Create slot at default time (just don't pass a timestamp to createSlot?)
        }
      }
    },
    'change .increment-selector' : function(evt) {
      var newIncrement = parseInt($(evt.target).val(), 10) * 60 * 1000;

      var slots = getSlotsCursor().fetch();
      var startingTimestamp = slots[0].slotTimestamp;
      for(var i = 1; i < slots.length; i++) {
        var newTimestamp = startingTimestamp + (i * newIncrement)
        var update = {
          slotTimestamp : newTimestamp,
          displayTime : getFormattedTime(newTimestamp, TIMEZONE)
        }
        TimeSlots.update(slots[i]._id, { $set: update});
      }
    },
    'keyup .time-slot-input' : function(evt) {
      return;
      if (!isAdmin) {
        var $input = $(evt.target);
        var val = $input.val();
        var $termsContainer = $input.closest("td").find(".terms-conditions");
        if (val === "") {
          $termsContainer.slideUp();
        } else {
          $termsContainer.slideDown();
        }
      }
    },
    'click #add-waitlist-name' : function() {
      addWaitlistName();
    },
    'click .remove-waitlist-name' : function(evt) {
      evt.preventDefault();
      if (confirm("Are you sure you wish to remove this person from the waitlist?")) {
        var $tgt = $(evt.target);
        var name = this.toString();
        Days.update({_id : Session.get("currentDayId")}, {$pull : {waitlist : name}});
      }
    },
    'keyup #waitlist-name' : function(evt) {
      if (evt.keyCode === 13) {
        addWaitlistName();
      }
    }
  });

  var INCREMENT = 20 * 60 * 1000

  function getFormattedTime(timestamp, timezone) {
    return moment(timestamp).tz(timezone).format("hh:mmA");
  }

  function createSlot(dayId, newTimestamp, ordinal) {
    var time = getFormattedTime(newTimestamp, TIMEZONE);
    var available = ordinal == 6 ? false : true;
    var newSlot = {
      "ordinal" : ordinal
      ,"dayId" : dayId
      ,"displayTime" : time
      ,"slotTimestamp":newTimestamp
      , "masseuse1" : {
          "customerName" : ""
          , available: available
        }
      , "masseuse2" : {
          "customerName" : ""
          , available: available
        }
    }

    TimeSlots.insert(newSlot);
  }

  function createSlots(dayId, timestamp) {
    var baseDate = moment(timestamp).tz(TIMEZONE);
    baseDate.hours("10");
    for (var i = 0; i < 14; i++) {
      var newTimestamp = baseDate.valueOf() + i * INCREMENT;
      createSlot(dayId, newTimestamp, i);
    }
  }

  Template.allSessions.formatTimestamp = function () {
    return moment(this.dayTimestamp).tz(TIMEZONE).format('MM/DD/YY');
  };

  Template.allSessions.days = function() {
    return Days.find({},{sort:{dayTimestamp:-1}});
  }

  Template.allSessions.selected = function() {
    return this._id == Session.get("currentDayId") ? "selected" : ""
  }

  Template.allSessions.rendered = function() {
    $("#new-day-date").datepicker({autoclose:true});
  }

  Template.allSessions.events({
    'change #day-select' : function(evt) {
      var $tgt = $(evt.target);
      var dayId = $tgt.val();
      Session.set("currentDayId",dayId);
    },
    'click .add-day' : function() {
      var newDayString = $("#new-day-date").val();
      if (newDayString.match(/^\d\d\/\d\d\/\d\d\d\d$/) && moment(newDayString, "MM/DD/YYYY").isValid()) {
        var parts = newDayString.split("/");
        var month = parseInt(parts[0], 10) - 1 //0 - 11
          , day   = parts[1]
          , year  = parts[2];
        var momentInPacificTZ = moment().tz(TIMEZONE);
        momentInPacificTZ.date(day).month(month).year(year).hours(0).minutes(0).seconds(0).milliseconds(0);
        var sinceEpoch = momentInPacificTZ.valueOf();
        var existingDay = Days.findOne({dayTimestamp:sinceEpoch});
        var dayId;
        var dayTimestamp;
        var needToCreateDay = true
        var needToCreateSlots = true
        if (existingDay) {
          dayId = existingDay._id
          dayTimestamp = existingDay.dayTimestamp;
          needToCreateDay = false;
          console.log("Found an existing day for %s (id:%s), looking for slots",newDayString, existingDay._id);
          var slotsForDay = TimeSlots.find({dayId:dayId}, {reactive:false}).count();
          console.log("Found %s time slots.", slotsForDay)
          if (slotsForDay > 0) {
            needToCreateSlots = false;
          }
        }

        if (needToCreateDay) {
          dayTimestamp = sinceEpoch;
          var dayData = {
            active:false,
            archived:false,
            dayTimestamp:dayTimestamp,
            masseuse1 : {
              name : "Erika"
            },
            masseuse2 : {
              name : ""
            }
          }
          dayId = Days.insert(dayData);
          console.log("Added new day %s with id %s", newDayString, dayId)
        }
        if (needToCreateSlots) {
          console.log("Creating slots for day %s with id", newDayString, dayId);
          createSlots(dayId, dayTimestamp);
        }

        Session.set("currentDayId",dayId);
      }
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
  });
}
