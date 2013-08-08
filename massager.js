/*
  
  Thoughts on security:
  Otherwise, we can set up user accounts, and create a /admin page (using router)

  We can remove autopublish and subscribe to the right docs based on role.

*/
//TODO: Remove insecure package
// Give INSERT permission to everyone
// Give DELETE permission to admin (with session variable)

//TODO: Remove autopublish package
// When isAdmin is checked, call subscribe (with name of admin - this should happen server side though!)

TimeSlots = new Meteor.Collection("timeSlots");
Days = new Meteor.Collection("days")

if (Meteor.isClient) {
  var isAdmin = null;

  Meteor.startup(function () {
    Meteor.call("isAdmin", document.location.pathname, document.location.search, function(err, result) {
      if (err) {
        console.log("Error occured whilst checking admin:", err)
      } else {
        isAdmin = result;
        Session.set("adminTrigger", moment().valueOf());
      }
    })
    $("#new-day-date").datepicker();

    Deps.autorun(function() {
      var latestActiveDay = Days.findOne({active:true}, {sort:{dayTimestamp : -1}})
      if (latestActiveDay) {
        console.log("Client init: Found an active day (%s). Setting currentDayId in session", moment(latestActiveDay.dayTimestamp).format("MM/DD/YYYY"));
        Session.set("currentDayId", latestActiveDay._id);
        Session.set("loaded", true);
      } else {
        console.log("Client init: Did not find an active day.")
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

  Handlebars.registerHelper("isAdmin", function() {
    Session.get("adminTrigger"); //HACK: cheap way of setting up a dependency :-)
    return isAdmin;
  });

  Template.massageTable.date = function() {
    //TODO: Fix
    var dayId = Session.get("currentDayId");
    if (dayId) {
      var dayEntry = Days.findOne(dayId);
      return moment(dayEntry.dayTimestamp).format('MMMM Do YYYY')
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
    if (dayId) return Days.findOne(dayId).active;    
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
    for (var i = 0; i < 15; i++) {
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
        //TODO: Convert to UTC?
        var newDay = moment(newDayString, "MM/DD/YYYY");
        var sinceEpoch = newDay.valueOf();
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
  });
}
