const enum ZoomConnectionStatus {
  //% block="None"
  NONE = 0,
  //% block="ESP device"
  ESP = 1,
  //% block="WiFi network"
  WIFI = 2,
  //% block="internet"
  INTERNET = 3,
  //% block="meeting room"
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
      notifiedConnectionStatus: number;
      device: string;
      espRX: SerialPin;
      espTX: SerialPin;
      ssid: string;
      wiFiPassword: string;
    }

    const SCREENSHOT_TOPIC = "_sc";
    const STRING_TOPIC = "_st";
    const NUMBER_TOPIC = "_nu";
    const CONNECTION_TOPIC = "$ESP/connection";
    const ERROR_TOPIC = "$ESP/error";

    let espState: EspState = undefined;
    let serialWriteString = (text: string) => {
      serial.writeString(text);
    };

    function normalize(value: string): string {
      return value.replaceAll(" ", "");
    }

    function splitNameValue(message: string): string[] {
      const splitIdx = message.indexOf(" ");
      if (splitIdx < 0) {
        return [message, ""];
      }
      let res = [];
      res.push(message.substr(0, splitIdx));
      res.push(message.substr(splitIdx + 1, message.length - splitIdx));
      return res;
    }

    function publish(name: string, value: string): void {
      serialWriteString("pub ");
      serialWriteString(normalize(name));
      serialWriteString(' "');
      serialWriteString("" + value);
      serialWriteString('"');
      serialWriteString("\n");
    }

    function subscribe(topic: string): void {
      serialWriteString("sub ");
      serialWriteString(topic);
      serialWriteString('"\n');
    }

    function processMessage(
      message: string,
      subscriptions: Subscription[]
    ): void {
      const nameValue = splitNameValue(message);

      for (let i = 0; i < subscriptions.length; ++i) {
        const sub = subscriptions[i];

        if (nameValue[0].indexOf(sub.name) == 0) {
          control.runInParallel(() => {
            if (sub.name == SCREENSHOT_TOPIC) {
              sub.handler(decodeImage(parseInt(nameValue[1])));
            } else {
              sub.handler(nameValue[1]);
            }
          });
          basic.pause(0);
        }
      }
    }

    function readSerialMessages(subscriptions: Subscription[]): void {
      let message: string = "";

      while (true) {
        while (serial.available() > 0) {
          const r = serial.read();
          if (r != -1) {
            if (r == Delimiters.NewLine) {
              processMessage(message, subscriptions);
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
    //% weight=49
    export function onReceivedString(
      handler: (receivedString: string) => void
    ): void {
      autoConnectToESP();
      espState.subscriptions.push(new Subscription(STRING_TOPIC, handler));
      subscribe(STRING_TOPIC);
    }

    /**
     * Do something when the micro:bit receives a number.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_on_receive_number"
    //% block="on zoom received"
    //% draggableParameters=reporter
    //% weight=50
    export function onReceivedNumber(
      handler: (receivedNumber: number) => void
    ): void {
      autoConnectToESP();
      espState.subscriptions.push(new Subscription(NUMBER_TOPIC, handler));
      subscribe(NUMBER_TOPIC);
    }

    /**
     * Do something when the micro:bit receives a screenshot.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_on_receive_screenshot"
    //% block="on zoom received"
    //% draggableParameters=reporter
    //% weight=48
    export function onReceivedScreenshot(
      handler: (receivedScreenshot: Image) => void
    ): void {
      autoConnectToESP();
      espState.subscriptions.push(new Subscription(SCREENSHOT_TOPIC, handler));
      subscribe(SCREENSHOT_TOPIC);
    }

    /**
     * Do something when the micro:bit receives a number in a channel.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_on_receive_number_in_channel"
    //% block="on zoom received in channel %channel"
    //% channel.min=0 channel.max=255 channel.defl=1
    //% draggableParameters=reporter
    //% weight=47
    export function onReceivedNumberInChannel(
      channel: number,
      handler: (receivedNumber: number) => void
    ): void {
      autoConnectToESP();
      const topic = "" + Math.floor(channel);
      espState.subscriptions.push(new Subscription(topic, handler));
      subscribe(topic);
    }

    /**
     * Do something when the ESP notifies an error.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_on_error"
    //% block="on zoom error"
    //% weight=29
    export function onError(handler: () => void): void {
      autoConnectToESP();
      espState.subscriptions.push(new Subscription(ERROR_TOPIC, handler));
    }

    /**
     * Do something when the connection status changes.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_on_connection_status"
    //% block="on zoom connection status"
    //% weight=30
    export function onConnectionStatus(handler: () => void): void {
      autoConnectToESP();
      espState.subscriptions.push(
        new Subscription(CONNECTION_TOPIC, () => {
          if (espState.connectionStatus != espState.notifiedConnectionStatus) {
            espState.notifiedConnectionStatus = espState.connectionStatus;
            handler();
          }
        })
      );
    }

    /**
     * Configures the WiFi connection.
     * @param ssid network name
     * @param password password
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_connect_wifi"
    //% block="zoom connect to WiFi network %ssid | and password %password"
    //% weight=98
    export function connectWiFi(ssid: string, password: string): void {
      autoConnectToESP();
      espState.ssid = ssid;
      espState.wiFiPassword = password;
      setWiFi();
    }

    function setWiFi() {
      serialWriteString('wifi "');
      serialWriteString(espState.ssid);
      serialWriteString('" "');
      serialWriteString(espState.wiFiPassword);
      serialWriteString('"\n');
    }

    function configureSubscriptionsAndPolling(): void {
      // Notify connnection status
      control.setInterval(
        () => {
          processMessage(
            CONNECTION_TOPIC + " " + ZoomConnectionStatus.NONE,
            espState.subscriptions
          );
        },
        1,
        control.IntervalMode.Timeout
      );

      // poll for device version
      const deviceInterval = control.setInterval(
        () => {
          serialWriteString("device\n");
        },
        300,
        control.IntervalMode.Interval
      );

      // keep device version
      espState.subscriptions.push(
        new Subscription("$ESP/device", (value: string) => {
          espState.device = value;
          control.clearInterval(deviceInterval, control.IntervalMode.Interval);
        })
      );

      // poll for intial connection status
      const connectionStatusInterval = control.setInterval(
        () => {
          serialWriteString("connection-status\n");
        },
        850,
        control.IntervalMode.Interval
      );

      // keep connection status
      espState.subscriptions.push(
        new Subscription("$ESP/connection", (status: number) => {
          espState.connectionStatus = status;
          if (status > ZoomConnectionStatus.NONE) {
            control.clearInterval(
              connectionStatusInterval,
              control.IntervalMode.Interval
            );
          }
        })
      );

      // poll for connection status in regulare intervals
      control.setInterval(
        () => {
          serialWriteString("connection-status\n");
        },
        62 * 1000,
        control.IntervalMode.Interval
      );

      // keep last error
      espState.subscriptions.push(
        new Subscription("$ESP/error", (value: string) => {
          espState.lastError = parseInt(value);
        })
      );
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
    //% weight=99
    export function connectESP(espRX: SerialPin, espTX: SerialPin): void {
      if (control.isSimulator()) {
        serialWriteString = (text: string) => {};
      }

      if (!espState || espState.espRX != espRX || espState.espTX != espTX) {
        serial.setRxBufferSize(32);
        serial.redirect(espRX, espTX, BaudRate.BaudRate9600);

        // establish clean connection
        while (serial.read() != -1) {}
        serialWriteString("----- -----\n");
      }

      if (!espState) {
        espState = {
          subscriptions: [],
          lastError: 0,
          meeting: "" + randint(1111111111, 9999999999),
          room: "1",
          connectionStatus: ZoomConnectionStatus.NONE,
          notifiedConnectionStatus: -1,
          device: "0.0.0",
          espRX: espRX,
          espTX: espTX,
          ssid: "",
          wiFiPassword: ""
        };

        control.runInParallel(() => {
          readSerialMessages(espState.subscriptions);
        });

        configureSubscriptionsAndPolling();
      }

      espState.espRX = espRX;
      espState.espTX = espTX;

      setMqttApplicationPrefix();

      if (!espState.ssid.isEmpty()) {
        setWiFi();
      }
    }

    /**
     * Returns the last error code.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_get_last_error"
    //% block="zoom error"
    //% weight=89
    export function getLastError(): number {
      if (!espState) {
        return 0;
      }
      return espState.lastError;
    }

    /**
     * Returns the ESP device firmware version.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_get_device"
    //% block="zoom device version"
    //% weight=88
    //% blockHidden=true
    export function getDevice(): string {
      if (!espState) {
        return "0";
      }
      return espState.device;
    }

    /**
     * Returns the connection status.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_get_connection_status"
    //% block="zoom connection"
    //% weight=90
    export function getConnectionStatus(): ZoomConnectionStatus {
      if (!espState) {
        return ZoomConnectionStatus.NONE;
      }
      return espState.connectionStatus;
    }

    function autoConnectToESP(): void {
      if (!espState) {
        makerbit.zoom.connectESP(SerialPin.P0, SerialPin.P1);
      }
    }

    /**
     * Broadcasts a string to other micro:bits that are connected to the same meeting room.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_send_string"
    //% block="zoom send string %value"
    //% value.shadowOptions.toString=true
    //% weight=79
    export function sendString(value: string): void {
      autoConnectToESP();
      publish(STRING_TOPIC, value);
    }

    /**
     * Broadcasts a number to other micro:bits that are connected to the same meeting room.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_send_number"
    //% block="zoom send number %value"
    //% weight=80
    export function sendNumber(value: number): void {
      autoConnectToESP();
      publish(NUMBER_TOPIC, "" + Math.roundWithPrecision(value, 2));
    }

    /**
     * Broadcasts a screenshot to other micro:bits that are connected to the same meeting room.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_send_screenshot"
    //% block="zoom send screenshot"
    //% weight=78
    export function sendScreenshot(): void {
      autoConnectToESP();
      publish(SCREENSHOT_TOPIC, "" + encodeImage(led.screenshot()));
    }

    /**
     * Broadcasts a number via a channel to other micro:bits that are connected to the same meeting room.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_send_number_to_channel"
    //% block="zoom send|number %value| to channel %channel"
    //% channel.min=0 channel.max=255 channel.defl=1
    //% weight=80
    export function sendNumberToChannel(value: number, channel: number): void {
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
    //% weight=97
    export function connectMeetingRoom(meeting: string, room: string): void {
      autoConnectToESP();
      espState.room = room;
      espState.meeting = normalize(meeting);
      setMqttApplicationPrefix();
    }

    /**
     * Returns true if the specified connection level is reached or exceeded.
     * False otherwise.
     */
    //% subcategory="Zoom"
    //% blockId="makerbit_zoom_is_connected"
    //% block="zoom is connected to %state"
    //% weight=91
    export function isConnected(status: ZoomConnectionStatus): boolean {
      if (!espState) {
        return false;
      }

      return espState.connectionStatus >= status;
    }

    function setMqttApplicationPrefix() {
      serialWriteString("mqtt-app ");
      serialWriteString(espState.meeting);
      serialWriteString("/");
      serialWriteString(espState.room);
      serialWriteString("\n");
    }

    function encodeImage(image: Image): number {
      let bits = 0;
      for (let x = 0; x <= 4; x++) {
        for (let y = 0; y <= 4; y++) {
          bits = bits << 1;
          if (image.pixel(x, y)) {
            bits = bits + 1;
          }
        }
      }
      return bits;
    }

    function decodeImage(bits: number): Image {
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
}
