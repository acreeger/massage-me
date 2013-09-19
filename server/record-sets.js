(function () {
  var adminOnly = function(userId) {
    return userId === "admin"
  }

  Days.allow({
    insert: adminOnly,
    update: function(userId, doc, fieldNames, modifier) {
      var isEditingWaitlist = fieldNames.length === 1 && _.indexOf(fieldNames,"waitlist") === 0;
      if (isEditingWaitlist) {
        if (modifier["$addToSet"]) {
          return true;
        }
      }
      return adminOnly(userId);
    },
    remove: function() {
      return false;
    }
  });

  TimeSlots.allow({
    insert: adminOnly,
    update: function() {
      //TODO: lock down the actual modifications they can make.
      return true;
    },
    remove: adminOnly
  });

  Meteor.publish("daysAndTimeSlots", function() {
    if (this.userId === "admin") {
      return [
        Days.find()
        , TimeSlots.find()
      ];
    } else {
      var daysCursor = Days.find({active:true}, {sort:{dayTimestamp : -1}, limit: 1})
      var timeSlotsCursor = null;
      var days = daysCursor.fetch();
      if (days.length > 0){
        var dayId = days[0]._id
        return [daysCursor, TimeSlots.find({dayId:dayId})]
      }
      return [
        daysCursor
        // , timeSlotsCursor
      ];
    }
    //Return both days and TimeSlots? how will we know which day?
  })
})();