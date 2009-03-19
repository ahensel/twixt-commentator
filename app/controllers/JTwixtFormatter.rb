class JTwixtFormatter
  def formatInt4Pair(key, value)
    return formatKey(key) +
           format4byteInt(4) +
           format4byteInt(value)
  end

  def formatInt1Pair(key, value)
    return formatKey(key) +
           format4byteInt(1) +
           format1byteInt(value)
  end

  def formatStringPair(key, value)
    return formatKey(key) +
           format4byteInt(value.length) +
           value
  end

  def formatKey(key)
    return format1byteInt(key.length) +
           key
  end

  def format4byteInt(value)
    return format2byteInt(value / (2**16)) +
           format2byteInt(value)
  end

  def format2byteInt(value)
    return format1byteInt(value / (2**8)) +
           format1byteInt(value)
  end

  def format1byteInt(value)
    return format("%c", value)  # just the lowest 8 bits
  end

  def formatStandardTwixtHeader(player1, player2)
    header = formatInt4Pair("gtv", 2);

    if player1 != nil
      header += formatStringPair("player1", player1)
    end

    if player2 != nil
      header += formatStringPair("player2", player2)
    end

    header += formatInt1Pair("pov", 0) +      # point of view (0 = alternate)
              formatStringPair("type", "twixt1") +
              formatInt4Pair("bdsize", 24) +  # board size
              formatInt4Pair("tgtv", 1) +     # twixt game tree version
              format2byteInt(0)

    return header
  end

  def formatMove(move)
    return format2byteInt(1) +   # one node (no tree)
           formatKey("m") +      # m for "move"
           format2byteInt(move.length) +
           move +
           format1byteInt(0)
  end

  def formatCoordinates(x, y)
    return format1byteInt(x - 1) +
           format1byteInt(y - 1)
  end

  def formatSimpleMove(x, y, player)
    return formatCoordinates(x, y) +
           format1byteInt(player)
  end

  def formatShortMove(x, y, player)
    return formatMove(formatSimpleMove(x, y, player))
  end
end
