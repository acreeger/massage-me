var TimeSlots = new Meteor.Collection("timeSlots");
var Days = new Meteor.Collection("days")

Meteor.publish("daysAndTimeSlots", function() {
  if (this.userId === "admin") {
    return [
      Days.find({}),
      TimeSlots.find({})
    ];
  } else {
    var daysCursor = Days.find({active:true}, {sort:{dayTimestamp : -1}, limit: 1})
    var timeSlotsCursor = null;
    var days = daysCursor.fetch();
    if (days.length > 0){
      var dayId = days[0]._id
      timeSlotsCursor = TimeSlots.find({dayId:dayId})
    }
    return [
      daysCursor,
      timeSlotsCursor
    ];
  } 
  //Return both days and TimeSlots? how will we know which day?
})