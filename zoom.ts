namespace makerbit {
  interface EspState {
    subscriptions: Subscription[];
    meetingId: string;
    groupId: number;
  }

  let espState: EspState = undefined;

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
        sub.handler(nameValue[1]);
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
    handler: (value: string | number) => void;

    constructor(name: string, handler: (value: string | number) => void) {
      this.name = normalize(name);
      serial.writeLine("sub " + this.name);
      this.handler = handler;
    }
  }

  /**
   * Registers code to run when the micro:bit receives a name value pair.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_on_receive_name_value"
  //% block="on zoom received %name"
  //% draggableParameters=reporter
  //% weight=20
  export function onReceivedNameValue(
    name: string,
    handler: (value: number) => void
  ) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.subscriptions.push(new Subscription(name, handler));
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
    espState.subscriptions.push(new Subscription("str", handler));
  }

  /**
   * Registers code to run when the micro:bit receives a number.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_on_receive_number"
  //% block="on zoom received"
  //% draggableParameters=reporter
  //% weight=30
  export function onReceivedNumber(handler: (receivedNumber: number) => void) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.subscriptions.push(new Subscription("num", handler));
  }

  /**
   * Configures the WiFi connection.
   * @param ssid network name
   * @param password password
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_set_wifi"
  //% block="zoom set WiFi network %ssid | and password %password"
  //% weight=80
  export function setWifi(ssid: string, password: string) {
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
  //% block="zoom connect with ESP TX attached to %espTx | and ESP RX to %espRx"
  //% espTx.defl=SerialPin.P0
  //% espRx.defl=SerialPin.P1
  //% weight=90
  export function connectESP(espTx: SerialPin, espRx: SerialPin) {
    if (control.isSimulator()) {
      return;
    }

    serial.setWriteLinePadding(0);
    serial.setRxBufferSize(32);
    serial.redirect(espTx, espRx, BaudRate.BaudRate9600);

    if (!espState) {
      espState = {
        subscriptions: [],
        meetingId: "" + randint(1111111111, 9999999999),
        groupId: 1,
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
   * Broadcasts a number to other micro:bits connected via the internet.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_send_number"
  //% block="zoom send number %value"
  //% weight=70
  export function sendNumber(value: number) {
    if (!autoConnectToESP()) {
      return;
    }
    publish("num", "" + value);
  }

  /**
   * Broadcasts a string to other micro:bits connected via the internet.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_send_string"
  //% block="zoom send string %value"
  //% value.shadowOptions.toString=true
  //% weight=60
  export function sendString(value: string) {
    if (!autoConnectToESP()) {
      return;
    }
    publish("str", value);
  }

  /**
   * Broadcasts a name / value pair to any connected micro:bit in the group.
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_send_value"
  //% block="zoom send|value %name|= %value"
  //% name.defl=name
  //% weight=50
  export function sendValue(name: string, value: number) {
    if (!autoConnectToESP()) {
      return;
    }
    serial.writeString("pub ");
    serial.writeString(normalize(name));
    serial.writeString(' "');
    serial.writeString("" + value);
    serial.writeString('"');
    serial.writeString("\n");
  }

  /**
   * Sets the group id for internet communications. A micro:bit can only listen to one one group in a meeting at any time.
   * @param id the group id between ``0`` and ``255``
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_set_group"
  //% block="zoom set group %id"
  //% id.defl=1 id.min=0 id.max=255
  //% weight=75
  //% blockHidden=1
  export function setGroup(id: number) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.groupId = id;
    updateMqttRoot();
  }

  /**
   * Sets the meeting id for internet communications. A micro:bit can only listen to one group in a meeting at any time.
   * @param id the meeting id
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_set_meeting"
  //% block="zoom set meeting %id"
  //% id.defl=123-456-7890
  //% weight=79
  //% blockHidden=1
  export function setMeeting(id: string) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.meetingId = normalize(id);
    updateMqttRoot();
  }

  /**
   * Sets the meeting and room for internet communications. A micro:bit can only listen to room at any time.
   * @param id the meeting id
   */
  //% subcategory="Zoom"
  //% blockId="makerbit_zoom_set_meeting_room"
  //% block="zoom set meeting %id and room %room"
  //% meetingId.defl=123-456-7890
  //% room.defl=1 room.min=0 room.max=255
  //% weight=74
  export function setMeetingRoom(meetingId: string, room: number) {
    if (!autoConnectToESP()) {
      return;
    }
    espState.groupId = room;
    espState.meetingId = normalize(meetingId);
    updateMqttRoot();
  }

  function updateMqttRoot() {
    serial.writeString("mqtt-root ");
    serial.writeString(espState.meetingId);
    serial.writeString("/");
    serial.writeNumber(espState.groupId);
    serial.writeString("\n");
  }
}
