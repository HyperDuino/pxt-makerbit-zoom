namespace makerbit {
  interface EspState {
    subscriptions: Subscription[];
    meeting: string;
    room: string;
  }

  let espState: EspState = undefined;

  const SCREENSHOT_TOPIC = "_sc";
  const STRING_TOPIC = "_st";
  const NUMBER_TOPIC = "_nu";

  function normalize(value: string) {
    return value.replaceAll(" ", "");
  }

  function splitNameValue(message: string) {
    const splitIdx = message.indexOf(" ");
    if (splitIdx < 0) {
      return [message, ""];
    }
    let res = [];
    res.push(message.substr(0, splitIdx));
    res.push(message.substr(splitIdx + 1, message.length - splitIdx));
    return res;
  }

  function processSubscriptions(message: string) {
    if (!espState) return;

    const nameValue = splitNameValue(message);

    for (let i = 0; i < espState.subscriptions.length; ++i) {
      const sub = espState.subscriptions[i];
      if (sub.name == nameValue[0]) {
        if (sub.name == SCREENSHOT_TOPIC) {
          sub.handler(decodeImage(nameValue[1]));
        } else {
          sub.handler(nameValue[1]);
        }
      }
    }
  }

  function readSerialMessages() {
    let message: string = "";

    while (true) {
      while (serial.available() > 0) {
        const r = serial.read();
        if (r != -1) {
          if (r == Delimiters.NewLine) {
            processSubscriptions(message);
            message = "";
          } else {
            message = message.concat(String.fromCharCode(r));
          }
        }
      }
      basic.pause(5);
    }
  }

  class Subscription {
    name: string;
    handler: (value: string | number | Image) => void;

    constructor(
      name: string,
      handler: (value: string | number | Image) => void
    ) {
      this.name = normalize(name);
      serial.writeLine("sub " + this.name);
      this.handler = handler;
    }
  }

  /**
   * Registers code to run when the micro:bit receives a string.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_on_receive_string"
  //% block="on zoom received"
  //% draggableParameters=reporter
  //% weight=40
  export function onReceivedString(handler: (receivedString: string) => void) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.subscriptions.push(new Subscription(STRING_TOPIC, handler));
  }

  /**
   * Registers code to run when the micro:bit receives a number.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_on_receive_number"
  //% block="on zoom received"
  //% draggableParameters=reporter
  //% weight=35
  export function onReceivedNumber(handler: (receivedNumber: number) => void) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.subscriptions.push(new Subscription(NUMBER_TOPIC, handler));
  }

  /**
   * Registers code to run when the micro:bit receives a screenshot.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_on_receive_screenshot"
  //% block="on zoom received"
  //% draggableParameters=reporter
  //% weight=30
  export function onReceivedScreenshot(
    handler: (receivedScreenshot: Image) => void
  ) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.subscriptions.push(new Subscription(SCREENSHOT_TOPIC, handler));
  }

  /**
   * Registers code to run when the micro:bit receives a number in a channel.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_on_receive_number_in_channel"
  //% block="on zoom received in channel %channel"
  //% channel.min=0 channel.max=255 channel.defl=1
  //% draggableParameters=reporter
  //% weight=20
  export function onReceivedNumberInChannel(
    channel: number,
    handler: (receivedNumber: number) => void
  ) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.subscriptions.push(new Subscription("" + Math.floor(channel), handler));
  }

  /**
   * Configures the WiFi connection.
   * @param ssid network name
   * @param password password
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_connect_wifi"
  //% block="zoom connect to WiFi network %ssid | and password %password"
  //% weight=80
  export function connectWifi(ssid: string, password: string) {
    if (!autoConnectToESP()) {
      return;
    }
    serial.writeString('wifi "');
    serial.writeString(ssid);
    serial.writeString('" "');
    serial.writeString(password);
    serial.writeString('"\n');
  }

  /**
   * Connects to the ESP8266 device.
   * @param espTx ESP8266 device transmitter pin (TX)
   * @param espRx ESP8266 device receiver pin (RX)
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_connect_esp"
  //% block="zoom connect with ESP RX attached to %espRX | and ESP TX to %espTX"
  //% espRX.defl=SerialPin.P0
  //% espTX.defl=SerialPin.P1
  //% weight=90
  export function connectESP(espRX: SerialPin, espTX: SerialPin) {
    if (control.isSimulator()) {
      return;
    }

    serial.setWriteLinePadding(0);
    serial.setRxBufferSize(32);
    serial.redirect(espRX, espTX, BaudRate.BaudRate9600);

    if (!espState) {
      espState = {
        subscriptions: [],
        meeting: "" + randint(1111111111, 9999999999),
        room: "1",
      };

      control.inBackground(readSerialMessages);
    }

    // establish clean connection
    serial.writeString("----- -----\n");
    serial.writeString("----- -----\n");
  }

  function autoConnectToESP(): boolean {
    if (!espState) {
      makerbit.connectESP(SerialPin.P0, SerialPin.P1);
    }
    return !!espState;
  }

  function publish(name: string, value: string) {
    serial.writeString("pub ");
    serial.writeString(normalize(name));
    serial.writeString(' "');
    serial.writeString("" + value);
    serial.writeString('"');
    serial.writeString("\n");
  }

  /**
   * Broadcasts a string to other micro:bits that are connected to the meeting room.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_send_string"
  //% block="zoom send string %value"
  //% value.shadowOptions.toString=true
  //% weight=70
  export function sendString(value: string) {
    if (!autoConnectToESP()) {
      return;
    }
    publish(STRING_TOPIC, value);
  }

  /**
   * Broadcasts a number to other micro:bits that are connected to the meeting room.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_send_number"
  //% block="zoom send number %value"
  //% weight=65
  export function sendNumber(value: number) {
    if (!autoConnectToESP()) {
      return;
    }

    publish(NUMBER_TOPIC, "" + Math.roundWithPrecision(value, 2));
  }

  /**
   * Broadcasts a screenshot to other micro:bits that are connected to the meeting room.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_send_screenshot"
  //% block="zoom send screenshot"
  //% weight=60
  export function sendScreenshot() {
    if (!autoConnectToESP()) {
      return;
    }

    publish(SCREENSHOT_TOPIC, "" + encodeImage(led.screenshot()));
  }

  /**
   * Broadcasts a number via a channel to other micro:bits that are connected to the meeting room.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_send_number_to_channel"
  //% block="zoom send|number %value| to channel %channel"
  //% channel.min=0 channel.max=255 channel.defl=1
  //% weight=50
  export function sendNumberToChannel(value: number, channel: number) {
    if (!autoConnectToESP()) {
      return;
    }
    publish("" + Math.floor(channel), "" + Math.roundWithPrecision(value, 2));
  }

  /**
   * Sets the meeting and room for internet communications. A micro:bit can be connected to one room at any time.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_connect_meeting_room"
  //% block="zoom connect to meeting %meeting and room %room"
  //% meetingId.defl=123-456-7890
  //% room.defl=1
  //% weight=74
  export function connectMeetingRoom(meeting: string, room: string) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.room = room;
    espState.meeting = normalize(meeting);
    updateMqttRoot();
  }

  function updateMqttRoot() {
    serial.writeString("mqtt-root ");
    serial.writeString(espState.meeting);
    serial.writeString("/");
    serial.writeString(espState.room);
    serial.writeString("\n");
  }

  function base64encode(data: number[]): string {
    const base64EncodeChars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let out = "";
    const len = data.length;
    let i = 0;
    while (i < len) {
      const c1 = data[i++] & 0xff;
      if (i == len) {
        out += base64EncodeChars.charAt(c1 >> 2);
        out += base64EncodeChars.charAt((c1 & 0x3) << 4);
        out += "==";
        break;
      }
      const c2 = data[i++];
      if (i == len) {
        out += base64EncodeChars.charAt(c1 >> 2);
        out += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
        out += base64EncodeChars.charAt((c2 & 0xf) << 2);
        out += "=";
        break;
      }
      const c3 = data[i++];
      out += base64EncodeChars.charAt(c1 >> 2);
      out += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
      out += base64EncodeChars.charAt(((c2 & 0xf) << 2) | ((c3 & 0xc0) >> 6));
      out += base64EncodeChars.charAt(c3 & 0x3f);
    }
    return out;
  }

  function base64decode(str: string): number[] {
    const base64DecodeChars = [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      62,
      -1,
      -1,
      -1,
      63,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      -1,
      -1,
      -1,
      -1,
      -1,
    ];

    let c1, c2, c3, c4;
    let i, len;
    let out = [];

    len = str.length;
    i = 0;

    while (i < len) {
      /* c1 */
      do {
        c1 = base64DecodeChars[str.charCodeAt(i++) & 0xff];
      } while (i < len && c1 == -1);
      if (c1 == -1) break;

      /* c2 */
      do {
        c2 = base64DecodeChars[str.charCodeAt(i++) & 0xff];
      } while (i < len && c2 == -1);
      if (c2 == -1) break;

      out.push((c1 << 2) | ((c2 & 0x30) >> 4));

      /* c3 */
      do {
        c3 = str.charCodeAt(i++) & 0xff;
        if (c3 == 61) return out;
        c3 = base64DecodeChars[c3];
      } while (i < len && c3 == -1);
      if (c3 == -1) break;

      out.push(((c2 & 0xf) << 4) | ((c3 & 0x3c) >> 2));

      /* c4 */
      do {
        c4 = str.charCodeAt(i++) & 0xff;
        if (c4 == 61) return out;
        c4 = base64DecodeChars[c4];
      } while (i < len && c4 == -1);
      if (c4 == -1) break;
      out.push(((c3 & 0x03) << 6) | c4);
    }
    return out;
  }

  function encodeImage(image: Image): string {
    let bits = 0;
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        bits = bits << 1;
        if (image.pixel(x, y)) {
          bits = bits + 1;
        }
      }
    }

    let bytes: number[] = [];
    for (let index = 0; index < 4; index++) {
      bytes.push(bits & 0xff);
      bits = bits >> 8;
    }

    return base64encode(bytes);
  }

  function decodeImage(value: string): Image {
    let bytes = base64decode(value);

    let bits = 0;
    for (let i = 3; i >= 0; i--) {
      bits = bits << 8;
      bits = bits + bytes[i];
    }

    let img = images.createImage("");
    for (let x = 4; x >= 0; x--) {
      for (let y = 4; y >= 0; y--) {
        img.setPixel(x, y, (bits & 0x01) == 1);
        bits = bits >> 1;
      }
    }

    return img;
  }
}
