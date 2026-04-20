// Translated from JTwixtFormatter.rb
// All methods return Buffers so they can be concatenated correctly for binary output.

class JTwixtFormatter {
  formatInt4Pair(key, value) {
    return Buffer.concat([
      this.formatKey(key),
      this.format4byteInt(4),
      this.format4byteInt(value),
    ]);
  }

  formatInt1Pair(key, value) {
    return Buffer.concat([
      this.formatKey(key),
      this.format4byteInt(1),
      this.format1byteInt(value),
    ]);
  }

  formatStringPair(key, value) {
    const valBuf = Buffer.from(value, 'binary');
    return Buffer.concat([
      this.formatKey(key),
      this.format4byteInt(valBuf.length),
      valBuf,
    ]);
  }

  formatKey(key) {
    const keyBuf = Buffer.from(key, 'binary');
    return Buffer.concat([this.format1byteInt(keyBuf.length), keyBuf]);
  }

  format4byteInt(value) {
    return Buffer.concat([
      this.format2byteInt(Math.floor(value / 65536)),
      this.format2byteInt(value),
    ]);
  }

  format2byteInt(value) {
    return Buffer.concat([
      this.format1byteInt(Math.floor(value / 256)),
      this.format1byteInt(value),
    ]);
  }

  format1byteInt(value) {
    return Buffer.from([value & 0xFF]);
  }

  formatStandardTwixtHeader(player1, player2) {
    let header = this.formatInt4Pair('gtv', 2);

    if (player1 != null) {
      header = Buffer.concat([header, this.formatStringPair('player1', player1)]);
    }
    if (player2 != null) {
      header = Buffer.concat([header, this.formatStringPair('player2', player2)]);
    }

    header = Buffer.concat([
      header,
      this.formatInt1Pair('pov', 0),
      this.formatStringPair('type', 'twixt1'),
      this.formatInt4Pair('bdsize', 24),
      this.formatInt4Pair('tgtv', 1),
      this.format2byteInt(0),
    ]);

    return header;
  }

  formatMove(move) {
    const moveBuf = Buffer.isBuffer(move) ? move : Buffer.from(move, 'binary');
    return Buffer.concat([
      this.format2byteInt(1),          // one node (no tree)
      this.formatKey('m'),             // m for "move"
      this.format2byteInt(moveBuf.length),
      moveBuf,
      this.format1byteInt(0),
    ]);
  }

  formatCoordinates(x, y) {
    return Buffer.concat([
      this.format1byteInt(x - 1),
      this.format1byteInt(y - 1),
    ]);
  }

  formatSimpleMove(x, y, player) {
    return Buffer.concat([
      this.formatCoordinates(x, y),
      this.format1byteInt(player),
    ]);
  }

  formatShortMove(x, y, player) {
    return this.formatMove(this.formatSimpleMove(x, y, player));
  }
}

module.exports = { JTwixtFormatter };
