function Link(peg1, peg2)
{
  if (peg1.y < peg2.y) {
    this.peg1 = peg1
    this.peg2 = peg2
  }
  else {
    this.peg1 = peg2
    this.peg2 = peg1
  }

  this.getLinkName = function() {
    return '_' + this.peg1.x + '_' + this.peg1.y + '_' + this.peg2.x + '_' + this.peg2.y
  }
  
  this.getNotation = function() {
    if (Math.abs(this.peg1.x - this.peg2.x) == 1) {
      return this.peg1.getXnotation(this.minX()) + "'" + this.peg1.getYnotation((this.peg1.y + this.peg2.y) / 2)
    }
    else {
      return this.peg1.getXnotation((this.peg1.x + this.peg2.x) / 2) + this.peg1.getYnotation(this.minY()) + "'"
    }
  }
  
  this.getRemoveNotation = function() {
    return "-" + this.getNotation()
  }
  
  this.getAddNotation = function() {
    return ((this.peg1.x < this.peg2.x) ? "\\" : "/") + this.getNotation()
  }
  
  this.toString = function() {
    return this.getAddNotation()
  }
  
  this.linkIndex = function(p1, p2) {
    return p1.getLinkIndex(p2.x - p1.x, p2.y - p1.y)
  }
  
  this.getIndex = function(peg) {
    if (peg == this.peg1) return this.linkIndex(peg, this.peg2)
    else                  return this.linkIndex(peg, this.peg1)
  }
  
  this.remove = function() {
    this.peg1.removeLink(this)
    this.peg2.removeLink(this)
  }
  
  this.minX = function() {
    return Math.min(this.peg1.x, this.peg2.x)
  }
  
  this.maxX = function() {
    return Math.max(this.peg1.x, this.peg2.x)
  }
  
  this.minY = function() {
    return Math.min(this.peg1.y, this.peg2.y)
  }
  
  this.maxY = function() {
    return Math.max(this.peg1.y, this.peg2.y)
  }
  
  peg1.addLink(this)
  peg2.addLink(this)  
}
