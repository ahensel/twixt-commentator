function Peg(color, x, y) {
  this.color = color;
  this.x = x;
  this.y = y;
  this.links = [];
  this.swapped = false;
  
  this.getXnotation = function(x) {
    return " abcdefghijklmnopqrstuvwx".charAt(x);
  };
  
  this.getYnotation = function(y) {
    return y;
  };
  
  this.getXYnotation = function(x, y) {
    return this.getXnotation(x) + this.getYnotation(y);
  };
  
  this.getNotation = function() {
    if (this.swapped) return this.getXYnotation(this.y, this.x);
    else return this.getXYnotation(this.x, this.y);
  };
  
  this.getLinkIndex = function(dx, dy) {
    return ((dx > 0)? 2:0) + ((dy > 0)? 3:2) + dy;
  };
  
  this.addLink = function(link) {
    this.links[link.getIndex(this)] = link;
  };
  
  this.removeLink = function(link) {
    this.links[link.getIndex(this)] = null;
  };
  
  this.getLink = function(dx, dy) {
    return this.links[this.getLinkIndex(dx, dy)];
  };
  
  this.getLinks = function() {
    var links = [];
    for (var i=0; i<8; i++) {
      var link = this.links[i];
      if (link != null) {
        links.push(link);
      }
    }
    return links;
  };
  
  this.hasLink = function(dx, dy) {
    return (this.getLink(dx, dy) != null);
  };
}
