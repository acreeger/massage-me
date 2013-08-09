//TODO: There is a slight bug: When a new page is created and activated, the non-admin clients are taken to the new page, with no time slots
//This isn't a major issue, a refresh fixes it, and only happens when the admin and client are viewing at exactly the same time, which isn't likely given our
//use cases.

/*****************

BUG: Dates created in chrome appear to be a day later than FF and Safari?
Is this due to the time stamp? Is it considering since ephoch in UTC instead of local?
ANSWER: It was because Chrome was stuck in a different timezone (EDT rather than PDT). So, I need to put stuff into UTC, and then always dispaly it in Pacific timezone.
TODO: Implement the above.
******************/

if (Meteor.isClient) {
  var TimeSlots = new Meteor.Collection("timeSlots");
  var Days = new Meteor.Collection("days")

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
              console.log("Client init: Found a day (%s, active: %s). Setting currentDayId in session", moment(latestDay.dayTimestamp).format("MM/DD/YYYY"), latestDay.active);
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

  
  Handlebars.registerHelper("loaded", function() {
    return Session.get("loaded");
  });

  Handlebars.registerHelper("isAdmin", getIsAdmin);

  Template.massageTable.date = function() {
    var day;
    var dayId = Session.get("currentDayId");
    if (dayId) {
      day = Days.findOne(dayId);
    }

    if (day) {
      return moment(day.dayTimestamp).format('MMMM Do YYYY')
    } else {
      return "None selected" //HACK
    }
  }

  //TODO: Implement this when we can change the masseuse name here
  Template.massageTable.masseuseName = function(masseuseNumber) {
    return "";
  }

  Template.massageTable.slots = function() {
    var dayId = Session.get("currentDayId");

    return TimeSlots.find({dayId:dayId}, {sort: {slotTimestamp:1}})   
  }

  Template.massageTable.currentDayIsActive = function() {
    var dayId = Session.get("currentDayId");
    if (dayId) day = Days.findOne(dayId);

    if (day) return day.active
    else return true;
  }

  function toggleAvailability(evt, slot, isAvailable) {
      evt.preventDefault();
      var $tgt = $(evt.target);
      var masseuse = $tgt.attr("data-masseuse");

      var field = "masseuse" + masseuse + ".available"
      var update = {};
      update[field] = isAvailable;
      TimeSlots.update(slot._id, { $set: update});
  }

  function updateCustomerName(slot, masseuse, name) {
    var field = "masseuse" + masseuse + ".customerName";
    var update = {};
    update[field] = name;
    TimeSlots.update(slot._id, { $set: update});
  }

  Template.massageTable.events({
    'click .book-time-slot' : function(evt) {
      var $tgt = $(evt.target);
      var masseuse = $tgt.attr("data-masseuse");

      var inputSelector = "#" + [masseuse,'input',this._id].join("-");
      var name = $(inputSelector).val();

      if (name !== "") {
        updateCustomerName(this, masseuse, name);
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
        var masseuse = $tgt.attr("data-masseuse");

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
    }
  });

  var INCREMENT = 20 * 60 * 1000

  function createSlots(dayId, timestamp) {
    var baseDate = moment(timestamp);
    baseDate.hours("10");
    for (var i = 0; i < 14; i++) {
      var newTimestamp = baseDate.valueOf() + i * INCREMENT
      var slotMoment = moment(newTimestamp);
      var time = slotMoment.format("hh:mmA");

      var newSlot = {
        "ordinal" : i
        ,"dayId" : dayId
        ,"displayTime" : time
        ,"slotTimestamp":newTimestamp
        , "masseuse1" : {
            "customerName" : ""
            , available: true
          }
        , "masseuse2" : {
            "customerName" : ""
            , available: true
          }
      }

      TimeSlots.insert(newSlot);
    }
  }

  Template.allSessions.formatTimestamp = function () {
    return moment(this.dayTimestamp).format('MM/DD/YY');
  };

  Template.allSessions.days = function() {
    return Days.find({},{sort:{dayTimestamp:-1}});
  }

  Template.allSessions.selected = function() {
    return this._id == Session.get("currentDayId") ? "selected" : ""
  }

  Template.allSessions.rendered = function() {
    $("#new-day-date").datepicker();
  }

  Template.allSessions.events({
    'change #day-select' : function(evt) {
      var $tgt = $(evt.target);
      var dayId = $tgt.val();
      Session.set("currentDayId",dayId);
    },
    'click .add-day' : function() {
      var newDayString = $("#new-day-date").val();
      //TODO: validation
      if (newDayString != "") {
        //TODO: Convert to UTC? Need to convert to PDT? Then store the UTC valueOf ??
        var newDay = moment(newDayString, "MM/DD/YYYY");
        var sinceEpoch = newDay.valueOf();
        // console.log("********* sinceEpoch", sinceEpoch);
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
      }
      if (needToCreateDay) {
        dayTimestamp = newDay.valueOf();
        dayId = Days.insert({active:false, archived:false,  dayTimestamp:dayTimestamp});
        console.log("Added new day %s with id %s", newDayString, dayId)
      }
      if (needToCreateSlots) {
        console.log("Creating slots for day %s with id", newDayString, dayId);
        createSlots(dayId, dayTimestamp);
      }

      Session.set("currentDayId",dayId);      
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    console.log("******* Meteor.settings:",Meteor.settings);
  });
}
