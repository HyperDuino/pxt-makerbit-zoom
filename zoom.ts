const enum ZoomConnectionStatus {
  //% block="None"
  NONE = 0,
  //% block="ESP device"
  ESP = 1,
  //% block="WiFi network"
  WIFI = 2,
  //% block="Internet"
  INTERNET = 3,
  //% block="Meeting room"
  MEETING = 4,
}

namespace makerbit {
  export namespace zoom {
    interface EspState {
      subscriptions: Subscription[];
      lastError: number;
      meeting: string;
      room: string;
      connectionStatus: number;
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

      if (
        espState.connectionStatus < ZoomConnectionStatus.ESP &&
        !nameValue[1].isEmpty()
      ) {
        espState.connectionStatus = ZoomConnectionStatus.ESP;
      }

      for (let i = 0; i < espState.subscriptions.length; ++i) {
        const sub = espState.subscriptions[i];

        if (nameValue[0].indexOf(sub.name) == 0) {
          if (sub.name == SCREENSHOT_TOPIC) {
            sub.handler(decodeImage(nameValue[1]));
          } else {
            //showStringOnLcd1602(nameValue[0], 1, 16);
            //showStringOnLcd1602(nameValue[1], 17, 16);
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
        // serial.writeLine("sub " + this.name);
        this.handler = handler;
        // showStringOnLcd1602("sub " + this.name, 17, 16);
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
    export function onReceivedString(
      handler: (receivedString: string) => void
    ) {
      autoConnectToESP();
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
    export function onReceivedNumber(
      handler: (receivedNumber: number) => void
    ) {
      autoConnectToESP();
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
      autoConnectToESP();
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
      autoConnectToESP();
      espState.subscriptions.push(
        new Subscription("" + Math.floor(channel), handler)
      );
    }

    /**
     * Registers code to run when the connection status changed.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_on_connection_status"
    //% block="on zoom connection status"
    //% draggableParameters=reporter
    //% weight=9
    export function onConnectionStatus(handler: () => void) {
      autoConnectToESP();
      espState.subscriptions.push(new Subscription("$ESP/connection", handler));
    }

    /**
     * Registers code to run when an error occurred.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_on_error"
    //% block="on zoom error"
    //% draggableParameters=reporter
    //% weight=8
    export function onError(handler: () => void) {
      autoConnectToESP();
      espState.subscriptions.push(new Subscription("$ESP/error", handler));
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
    export function connectWiFi(ssid: string, password: string) {
      autoConnectToESP();
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

      // establish clean connection
      serial.writeString("----- -----\n");
      serial.writeString("----- -----\n");

      if (!espState) {
        espState = {
          subscriptions: [],
          lastError: 0,
          meeting: "" + randint(1111111111, 9999999999),
          room: "1",
          connectionStatus: ZoomConnectionStatus.NONE,
        };

        // keep last error
        espState.subscriptions.push(
          new Subscription("$ESP/error", (value: string) => {
            espState.lastError = parseInt(value);
          })
        );

        espState.subscriptions.push(
          new Subscription("$ESP/connection", (status: number) => {
            espState.connectionStatus = status;
          })
        );

        control.inBackground(readSerialMessages);
        basic.pause(500);
      }

      control.setInterval(
        () => {
          serial.writeString("connection-status\n");
        },
        500,
        control.IntervalMode.Timeout
      );
    }

    /**
     * Returns the connection status.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_connection_status"
    //% block="zoom connection status"
    //% weight=19
    export function getConnectionStatus(): ZoomConnectionStatus {
      if (!espState) {
        return ZoomConnectionStatus.NONE;
      }
      return espState.connectionStatus;
    }

    /**
     * Returns the last error code and sets it to 0.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_last_error"
    //% block="zoom last error"
    //% weight=18
    export function getLastError(): number {
      if (!espState) {
        return 0;
      }
      const result = espState.lastError;
      espState.lastError = 0;
      return result;
    }

    function autoConnectToESP(): void {
      if (!espState) {
        makerbit.zoom.connectESP(SerialPin.P0, SerialPin.P1);
      }
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
      autoConnectToESP();
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
      autoConnectToESP();

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
      autoConnectToESP();

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
      autoConnectToESP();
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
      autoConnectToESP();
      espState.room = room;
      espState.meeting = normalize(meeting);
      updateMqttRoot();
    }

    /**
     * Returns true if connected at the specified level or better.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_is_connected"
    //% block="zoom is connected to %state"
    //% weight=73
    export function isConnected(status: ZoomConnectionStatus): boolean {
      if (!espState) {
        return false;
      }

      return espState.connectionStatus >= status;
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
      let j = 0;
      while (j < len) {
        const c1 = data[j++] & 0xff;
        if (j == len) {
          out += base64EncodeChars.charAt(c1 >> 2);
          out += base64EncodeChars.charAt((c1 & 0x3) << 4);
          out += "==";
          break;
        }
        const c2 = data[j++];
        if (j == len) {
          out += base64EncodeChars.charAt(c1 >> 2);
          out += base64EncodeChars.charAt(
            ((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4)
          );
          out += base64EncodeChars.charAt((c2 & 0xf) << 2);
          out += "=";
          break;
        }
        const c3 = data[j++];
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

      let c12, c22, c32, c4;
      let k, len2;
      let out2 = [];

      len2 = str.length;
      k = 0;

      while (k < len2) {
        /* c1 */
        do {
          c12 = base64DecodeChars[str.charCodeAt(k++) & 0xff];
        } while (k < len2 && c12 == -1);
        if (c12 == -1) break;

        /* c2 */
        do {
          c22 = base64DecodeChars[str.charCodeAt(k++) & 0xff];
        } while (k < len2 && c22 == -1);
        if (c22 == -1) break;

        out2.push((c12 << 2) | ((c22 & 0x30) >> 4));

        /* c3 */
        do {
          c32 = str.charCodeAt(k++) & 0xff;
          if (c32 == 61) return out2;
          c32 = base64DecodeChars[c32];
        } while (k < len2 && c32 == -1);
        if (c32 == -1) break;

        out2.push(((c22 & 0xf) << 4) | ((c32 & 0x3c) >> 2));

        /* c4 */
        do {
          c4 = str.charCodeAt(k++) & 0xff;
          if (c4 == 61) return out2;
          c4 = base64DecodeChars[c4];
        } while (k < len2 && c4 == -1);
        if (c4 == -1) break;
        out2.push(((c32 & 0x03) << 6) | c4);
      }
      return out2;
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
      let bytes2 = base64decode(value);

      let bits2 = 0;
      for (let l = 3; l >= 0; l--) {
        bits2 = bits2 << 8;
        bits2 = bits2 + bytes2[l];
      }

      let img = images.createImage("");
      for (let x2 = 4; x2 >= 0; x2--) {
        for (let y2 = 4; y2 >= 0; y2--) {
          img.setPixel(x2, y2, (bits2 & 0x01) == 1);
          bits2 = bits2 >> 1;
        }
      }

      return img;
    }
  }
}
