//TODO: Remove insecure package
// Give INSERT permission to everyone
// Give DELETE permission to admin (with session variable)

TimeSlots = new Meteor.Collection("timeSlots");

if (Meteor.isClient) {
  Meteor.startup(function () {
    $("#new-day-date").datepicker();
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
    return moment().format('MMMM Do YYYY');
  }

  Template.massageTable.events({
    'click .book-time-slot' : function() {
      
    }
  });

  Template.allSessions.events({
    'click .add-day' : function() {
      console.log("this");
    }
  });

  Template.massageTable.slots = function() {
    return [
      {
        "slot" : 0
        ,"time" : "10:00am"
        , "masseuse1" : {
            "customerName" : ""
          }
        , "masseuse2" : {
            "customerName" : ""
          }
        , available : true
      }
      ,{
        "slot" : 1
        ,"time" : "10:20am"
        , "masseuse1" : {
            "customerName" : ""
          }
        , "masseuse2" : {
            "customerName" : "Julia J"
          }
        , available : true
      }
      ,{
        "slot" : 2
        ,"time" : "10:40am"
        , "masseuse1" : {
            "customerName" : "Adam C"
          }
        , "masseuse2" : {
            "customerName" : ""
          }
        , available : true
      }
      ,{
        "slot" : 3
        ,"time" : "11:00am"
        , "masseuse1" : {
            "customerName" : "Bob B"
          }
        , "masseuse2" : {
            "customerName" : "James G"
          }
        , available : true
      }
    ]
  }
}

if (Meteor.isServer) {
  Meteor.startup(function () {
  });
}
