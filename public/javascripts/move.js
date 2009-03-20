function Move()
{
  this.removedLinks = [];
  this.addedLinks = [];
  
  this.removeLink = function(link) {
    var index = this.indexOf(this.addedLinks, link);
    if (index >= 0) {
      this.addedLinks.splice(index, 1);
    }
    else {
      this.removedLinks.push(link);
    }
  };
  
  this.addLink = function(link) {
    var index = this.indexOf(this.removedLinks, link);
    if (index >= 0) {
      this.removedLinks.splice(index, 1);
    }
    else {
      this.addedLinks.push(link);
    }
  };

  this.indexOf = function(links, link) {
    for (var i = 0; i < links.length; i++) {
      if (links[i].toString() == link.toString()) return i;
    }
    return -1;
  };
  
  this.sortLinks = function(links) {
    links.sort(function(link1, link2) {
      var link1y = link1.peg1.y + link1.peg2.y;
      var link2y = link2.peg1.y + link2.peg2.y;
      
      if (link1y < link2y) return -1;
      else if (link1y > link2y) return 1;
      else {
        var link1x = link1.peg1.x + link1.peg2.x;
        var link2x = link2.peg1.x + link2.peg2.x;

        if (link1x < link2x) return -1;
        else if (link1x > link2x) return 1;
      }
      return 0;
    });
    return links;
  };
  
  this.setPeg = function(peg) {
    this.peg = peg;
  };
  
  this.getText = function() {
    var text = "";
    
    this.sortLinks(this.removedLinks).each(function(link) {
      text += link.getRemoveNotation();
    });
    
    this.sortLinks(this.addedLinks).each(function(link) {
      text += link.getAddNotation();
    });
    
    return text + this.peg.getNotation();
  };
}

function SwapMove() {
  this.getText = function() {
    return "swap";
  };
}

function ResignMove() {
  this.getText = function() {
    return "resign";
  };
}

function DrawMove() {
  this.getText = function() {
    return "draw";
  };
}

function ForfeitMove() {
  this.getText = function() {
    return "forfeit";
  };
}

function LostMove() {
  this.getText = function() {
    return "lost";
  };
}