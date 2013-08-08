Meteor.methods({
  isAdmin : function(path, querystring) {
    var key = process.env.ADMIN_KEY;
    if (path == "/super_special_people") {
      if (key == null || typeof key === "undefined") {        
        return true;  
      } else {
        QueryString = Match.Where(function (x) {
          return Match.test(x, String) && x.length > 0 && x[0] === "?" && x.indexOf("=") > 0
        });
        if (Match.test(querystring, QueryString)) {
          querystring = querystring.substring(1);
          var elements = querystring.split("&");
          var obj = {}
          for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var nameValue = el.split("=");
            obj[decodeURIComponent(nameValue[0])] = decodeURIComponent(nameValue[1]);
          }

          if (obj.key === key) {
            this.setUserId("admin");
            return true;
          } else {
            return false;
          }
        } else {
          return false;
        }
      }
    } else {
      return false;
    }
  }
})