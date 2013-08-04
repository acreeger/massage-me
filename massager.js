//TODO: Remove insecure package
// Give INSERT permission to everyone
// Give DELETE permission to admin (with session variable)

TimeSlots = new Meteor.Collection("timeSlots");
Days = new Meteor.Collection("days")

if (Meteor.isClient) {
  Meteor.startup(function () {
    $("#new-day-date").datepicker();

    var latestActiveDay = Days.findOne({active:true}, {sort:{dayTimestamp : -1}})
    if (latestActiveDay) {
      console.log("Found an active day (%s). Setting currentDayId in session", moment(latestActiveDay.dayTimestamp).format("MM/DD/YYYY"));
      Session.set("currentDayId", latestActiveDay._id)
    }
  });

  // Template.hello.events({
  //   'click input' : function () {
  //     // template data, if any, is available in 'this'
  //     if (typeof console !== 'undefined')
  //       console.log("You pressed the button");
  //   }
  // });

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

  Template.massageTable.events({
    'click .book-time-slot' : function(evt) {
      console.log("this",this)
      console.log("evt",evt);
      var $tgt = $(evt.target);
      var slotId = $tgt.attr("data-slotId");
      var masseuse = $tgt.attr("data-masseuse");

      var inputSelector = "#" + [masseuse,'input',slotId].join("-");
      console.log("inputSelector:",inputSelector)
      console.log("$(inputSelector):",$(inputSelector))
      var name = $(inputSelector).val();

      if (name !== "") {
        var field = "masseuse" + masseuse //+ ".customerName"        
        var update = {};
        update[field] = {customerName: name};
        TimeSlots.update(this._id, { $set: update});
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
      console.log(time);

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

      console.log("writing slot %s to DB", i);
      TimeSlots.insert(newSlot);
      // console.log(time);
    }
  }

  Template.allSessions.events({
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
        dayId = Days.insert({active:true, dayTimestamp:dayTimestamp});
        console.log("Added new day %s with id %s", newDayString, dayId)
      }
      if (needToCreateSlots) {
        console.log("Creating slots for day %s with id", newDayString, dayId);
        createSlots(dayId, dayTimestamp);
      }

      Session.set("currentDayId",dayId);      
    }
  });

  Template.massageTable.slots = function() {
    var dayId = Session.get("currentDayId");

    return TimeSlots.find({dayId:dayId}, {sort: {slotTimestamp:1}})    
  }
}

if (Meteor.isServer) {
  Meteor.startup(function () {
  });
}
