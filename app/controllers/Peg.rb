class Peg
  attr_accessor :color

  def initialize(color)
    @link = Array.new(8, false)
    @color = color
  end

  def isLinkDistance(dx, dy)
    return ((dx * dy).abs == 2)
  end

  def setLinkStatus(dx, dy, status)
    if isLinkDistance(dx, dy)
      @link[getLinkIndex(dx, dy)] = status
    end
  end

  def setLink(dx, dy)
    setLinkStatus(dx, dy, true)
  end

  def removeLink(dx, dy)
    setLinkStatus(dx, dy, false)
  end

  def hasLink(dx, dy)
    isLinkDistance(dx, dy)? @link[getLinkIndex(dx, dy)] : false
  end

  def getLinkIndex(dx, dy)
    #    0     2
    #  1         3
    #       *
    #  4         6
    #    5     7
    # (this arrangement is easy to calculate,
    # and opposite links add up to 7)
    return ((dx > 0)? 2:0) + ((dy > 0)? 3:2) + dy
  end

end
