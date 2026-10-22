// Protocolo do Cuvave Cube Baby (ver ../PROTOCOLO.md). Sem dependências de navegador.
(function (root) {
  const HDR_READ = [0xf0, 0x00, 0x32, 0x0d, 0x41, 0x03, 0x00, 0x40, 0x02, 0, 0, 0, 0, 0, 0x06, 0, 0];
  const HDR_SAVE = HDR_READ.slice(); HDR_SAVE[3] = 0x09;
  const DATA_LEN = 47;

  const CONTROLS = [
    { id: 0, key: 'treb', label: 'TREB', max: 127 },
    { id: 1, key: 'mid', label: 'MID', max: 127 },
    { id: 2, key: 'bass', label: 'BASS', max: 127 },
    { id: 3, key: 'time', label: 'TIME', max: 127 },
    { id: 4, key: 'mod', label: 'MOD', max: 15 },
    { id: 5, key: 'volume', label: 'VOLUME', max: 127 },
    { id: 6, key: 'antifb', label: 'ANTI FB', max: 8 },
    { id: 7, key: 'space', label: 'SPACE', max: 31 },
    { id: 8, key: 'comp', label: 'COMP', max: 8 },
    { id: 9, key: 'ircab', label: 'IR CAB', max: 8 },
    { id: 10, key: 'sw1', label: 'IR Cab', max: 1, toggle: true },
    { id: 11, key: 'sw2', label: 'Efeitos (Time/Space/Mod)', max: 1, toggle: true },
    { id: 12, key: 'sw3', label: 'Tom (Anti FB/Comp/EQ)', max: 1, toggle: true },
  ];

  function unpack7(b) {
    const out = []; let acc = 0, n = 0;
    for (const x of b) {
      acc |= (x & 0x7f) << n; n += 7;
      while (n >= 8) { out.push(acc & 0xff); acc >>= 8; n -= 8; }
    }
    return out;
  }

  function pack7(bytes) {
    const out = []; let acc = 0, n = 0;
    for (const x of bytes) {
      acc |= (x & 0xff) << n; n += 8;
      while (n >= 7) { out.push(acc & 0x7f); acc >>= 7; n -= 7; }
    }
    if (n > 0) out.push(acc & 0x7f);
    return out;
  }

  const bufChecksum = (data) => (202 - data.reduce((a, b) => a + b, 0)) & 0xff;

  // msg: array de bytes de uma resposta F0 00 32 0D 41 03 ... F7. Devolve {data, checksumOk}.
  function parseDump(msg) {
    if (msg.length !== 74) throw new Error('tamanho inesperado: ' + msg.length);
    const d = unpack7(msg.slice(17, -1));
    const data = d.slice(0, DATA_LEN);
    return { data, checksumOk: d[47] === 0 && d[48] === bufChecksum(data) };
  }

  function buildDump(data, hdr) {
    const full = data.concat([0, bufChecksum(data)]);
    return (hdr || HDR_SAVE).concat(pack7(full), [0xf7]);
  }

  function paramMsg(id, v) {
    const N = (((242 - 2 * id - 2 * v) % 512) + 512) % 512;
    return [0xf0, 0x00, 0x32, 0x09, 0x49, 0x00, 0x00, 0x40, 0x02, id, 0, 0, 0, 0x18, 0, 0, 0, v, N & 0x7f, N >> 7, 0xf7];
  }

  const HANDSHAKE = [
    [0xf0, 0x00, 0x32, 0x45, 0x00, 0x00, 0x00, 0x40, 0x7f, 0xf7],
    [0xf0, 0x00, 0x32, 0x0d, 0x41, 0x00, 0x00, 0x00, 0x00, 0x00, 0x42, 0x00, 0x00, 0x40, 0x02, 0x00, 0x00, 0x4a, 0x01, 0xf7],
    [0xf0, 0x00, 0x32, 0x49, 0x00, 0x00, 0x00, 0x40, 0x7f, 0xf7],
  ];
  const REQUEST_PRESETS = [0xf0, 0x00, 0x32, 0x0d, 0x41, 0x00, 0x00, 0x40, 0x02, 0, 0, 0, 0, 0, 0x06, 0, 0, 0x4a, 0x01, 0xf7];

  /* ---------- Upload de IR (ver PROTOCOLO.md) ----------
     O aparelho recebe 513 floats32 LE: [distance (0..1), amostra0 .. amostra511] em 48 kHz.
     16 pacotes de 128 bytes (n = 3..0x12) + 1 pacote final de 4 bytes (n = 0x13), cada um com
     checksum = (K - soma dos bytes - bytes do endereço n*128) & 0xFF, empacotado em 7 bits. */
  const IR_SAMPLES = 512;
  const IR_PRE = [
    [0xf0, 0x00, 0x32, 0x09, 0x49, 0, 0, 0, 0x02, 0x00, 0x03, 0, 0, 0x10, 0, 0, 0, 0x00, 0x72, 0x01, 0xf7],
    [0xf0, 0x00, 0x32, 0x11, 0x49, 0, 0, 0, 0x02, 0x00, 0x03, 0, 0, 0x10, 0, 0, 0, 0x00, 0x72, 0x01, 0xf7],
  ];
  const IR_POST = [
    [0xf0, 0x00, 0x32, 0x11, 0x49, 0, 0, 0, 0x02, 0x04, 0x03, 0, 0, 0x40, 0, 0x02, 0, 0x00, 0x54, 0x01, 0xf7],
    [0xf0, 0x00, 0x32, 0x09, 0x49, 0, 0, 0, 0x02, 0x00, 0x03, 0, 0, 0x10, 0, 0, 0, 0x01, 0x70, 0x01, 0xf7],
    [0xf0, 0x00, 0x32, 0x11, 0x49, 0, 0, 0, 0x02, 0x00, 0x03, 0, 0, 0x10, 0, 0, 0, 0x00, 0x72, 0x01, 0xf7],
  ];
  function irChunk(n, bytes, K) {
    const a = n * 128, s = bytes.reduce((x, y) => x + y, 0);
    return pack7(bytes.concat([(K - s - (a & 0xff) - (a >> 8)) & 0xff]));
  }
  // samples: amostras em 48 kHz (-1..1); usa as 512 primeiras. distance: 0..1 (o CubeSuite manda 0.5 = 50%).
  function irUpload(samples, distance) {
    const f = new Float32Array(IR_SAMPLES + 1);
    f[0] = distance == null ? 0.5 : distance;
    for (let i = 0; i < IR_SAMPLES; i++) f[i + 1] = samples[i] || 0;
    const bytes = Array.from(new Uint8Array(f.buffer));
    const msgs = IR_PRE.map(m => m.slice());
    for (let p = 0; p < 16; p++) {
      const n = 3 + p;
      msgs.push([0xf0, 0x00, 0x32, 0x09, 0x41, 0x08, 0, 0, 0x02, 0x04, n, 0, 0, 0, 0x10, 0, 0].concat(irChunk(n, bytes.slice(p * 128, p * 128 + 128), 119), [0xf7]));
    }
    msgs.push([0xf0, 0x00, 0x32, 0x09, 0x61, 0, 0, 0, 0x02, 0x04, 0x13, 0, 0, 0x40, 0, 0, 0].concat(irChunk(0x13, bytes.slice(2048, 2052), 243), [0xf7]));
    return msgs.concat(IR_POST.map(m => m.slice()));
  }

  /* ---------- Gravar a IR num slot de importação (1..8) ----------
     Sequência do CubeSuite ao clicar Save: upload de transferência (irUpload), depois
       05 29 (endereço do slot) + 16 pacotes de 128 bytes + 09 01 (confirmação).
     Endereço do slot n, em blocos de 128 bytes: 0xD00 + 32*n (slots 7 e 8 e 1 e 5 conferidos).
     Imagem gravada = 4 bytes zero + os 2044 primeiros bytes do upload (distance + 510 amostras).
     Regras de checksum deduzidas de 4 slots (1, 5, 7, 8); os demais (2, 3, 4, 6) são extrapolados. */
  const IR_SLOT_MIN = 1, IR_SLOT_MAX = 8, IR_SLOT_VERIFIED = [1, 5, 7, 8];
  const irSlotAddr = (n) => 0xd00 + 32 * n;
  function irWrite(slot, samples, distance) {
    if (!(slot >= IR_SLOT_MIN && slot <= IR_SLOT_MAX)) throw new Error('slot de IR inválido: ' + slot);
    const f = new Float32Array(IR_SAMPLES + 1);
    f[0] = distance == null ? 0.5 : distance;
    for (let i = 0; i < IR_SAMPLES; i++) f[i + 1] = samples[i] || 0;
    const T = Array.from(new Uint8Array(f.buffer));
    const F = [0, 0, 0, 0].concat(T.slice(0, 2044));
    const A = irSlotAddr(slot), msgs = irUpload(samples, distance);
    msgs.push([0xf0, 0x00, 0x32, 0x05, 0x29, 0, 0, 0, 0, 0, A & 0x7f, A >> 7, 0, slot === 8 ? 0 : 0x10, ((496 - A) & 0x1ff) >> 4, 0xf7]);
    for (let i = 0; i < 16; i++) {
      const a = A + i, data = F.slice(i * 128, i * 128 + 128), by = a * 128;
      const chk = (127 - data.reduce((x, y) => x + y, 0) - (by & 0xff) - ((by >> 8) & 0xff) - ((by >> 16) & 0xff)) & 0xff;
      msgs.push([0xf0, 0x00, 0x32, 0x09, 0x41, 0x08, 0, 0, 0, 0, a & 0x7f, a >> 7, 0, 0, 0x10, 0, 0].concat(pack7(data.concat([chk])), [0xf7]));
    }
    const E = A + 16, N = (((482 - (slot === 8 ? 2 : 0) - E) % 512) + 512) % 512;
    msgs.push([0xf0, 0x00, 0x32, 0x09, 0x01, 0x01, 0, 0, 0, 0, E & 0x7f, E >> 7, 0, 0, 0x01].concat(new Array(11).fill(0), [N & 0x7f, N >> 7, 0xf7]));
    return msgs;
  }

  // Lê um WAV (PCM 16/24/32 bits ou float 32), usa o 1º canal. Devolve {rate, samples: Float64Array}.
  function parseWav(buf) {
    const dv = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer);
    const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('não é um arquivo WAV');
    let fmt = null, off = 12;
    while (off + 8 <= dv.byteLength) {
      const id = tag(off), size = dv.getUint32(off + 4, true), body = off + 8;
      if (id === 'fmt ') {
        let format = dv.getUint16(body, true);
        if (format === 0xfffe && size >= 26) format = dv.getUint16(body + 24, true);
        fmt = { format, ch:dv.getUint16(body + 2, true), rate:dv.getUint32(body + 4, true), bits:dv.getUint16(body + 14, true) };
      } else if (id === 'data') {
        if (!fmt) throw new Error('WAV sem cabeçalho fmt');
        const bps = fmt.bits / 8, frame = bps * fmt.ch, n = Math.floor(Math.min(size, dv.byteLength - body) / frame);
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          const o = body + i * frame;
          if (fmt.format === 3 && fmt.bits === 32) out[i] = dv.getFloat32(o, true);
          else if (fmt.format === 1 && fmt.bits === 16) out[i] = dv.getInt16(o, true) / 32768;
          else if (fmt.format === 1 && fmt.bits === 24) { let v = dv.getUint8(o) | (dv.getUint8(o + 1) << 8) | (dv.getUint8(o + 2) << 16); if (v & 0x800000) v -= 0x1000000; out[i] = v / 8388608; }
          else if (fmt.format === 1 && fmt.bits === 32) out[i] = dv.getInt32(o, true) / 2147483648;
          else throw new Error('formato de WAV não suportado (' + fmt.bits + ' bits, tipo ' + fmt.format + ')');
        }
        return { rate:fmt.rate, ch:fmt.ch, bits:fmt.bits, samples:out };
      }
      off = body + size + (size & 1);
    }
    throw new Error('WAV sem dados');
  }

  // Reamostra para 48 kHz com sinc janelado (só usado quando o WAV não é 48 kHz).
  function resample(x, from, to, count) {
    if (from === to) return x;
    const ratio = to / from, cut = Math.min(1, ratio), half = 32, out = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const t = i / ratio, c = Math.floor(t); let acc = 0;
      for (let k = c - half + 1; k <= c + half; k++) {
        if (k < 0 || k >= x.length) continue;
        const d = t - k, w = 0.5 + 0.5 * Math.cos(Math.PI * d / half);
        const s = d === 0 ? cut : Math.sin(Math.PI * d * cut) / (Math.PI * d);
        acc += x[k] * s * w;
      }
      out[i] = acc;
    }
    return out;
  }

  const api = { CONTROLS, unpack7, pack7, bufChecksum, parseDump, buildDump, paramMsg, HANDSHAKE, REQUEST_PRESETS, HDR_READ, HDR_SAVE, DATA_LEN,
    IR_SAMPLES, irUpload, irWrite, IR_SLOT_MIN, IR_SLOT_MAX, IR_SLOT_VERIFIED, parseWav, resample };
  if (typeof module !== 'undefined') module.exports = api; else root.Cube = api;
})(this);
