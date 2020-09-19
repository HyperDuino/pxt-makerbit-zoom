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

  export function onReceivedNameValue(
    name: string,
    handler: (value: string) => void
  ) {
    autoConnectToESP();
    espState.subscriptions.push(new Subscription(name, handler));
  }

  export function onReceivedString(handler: (receivedString: string) => void) {
    autoConnectToESP();
    espState.subscriptions.push(new Subscription("str", handler));
  }

  export function onReceivedNumber(handler: (receivedNumber: number) => void) {
    autoConnectToESP();
    espState.subscriptions.push(new Subscription("num", handler));
  }

  function autoConnectToESP() {
    if (!espState) {
      makerbit.connectESP(SerialPin.P0, SerialPin.P1);
    }
  }

  /**
   * Configure WiFi
   */
  //% block="Initialize ESP8266|Wifi SSID = %ssid|Wifi PW = %pw"
  //% ssid.defl=your_ssid
  //% pw.defl=your_pw
  export function setWifi(ssid: string, pw: string) {
    autoConnectToESP();
    serial.writeString('wifi "');
    serial.writeString(ssid);
    serial.writeString('" "');
    serial.writeString(pw);
    serial.writeString('"\n');
  }

  /**
   * Initialize ESP8266 module
   */
  //% block="Initialize ESP8266|RX (Tx of micro:bit) %tx|TX (Rx of micro:bit) %rx"
  //% tx.defl=SerialPin.P0
  //% rx.defl=SerialPin.P1
  export function connectESP(tx: SerialPin, rx: SerialPin) {
    serial.setWriteLinePadding(0);
    serial.setRxBufferSize(32);
    serial.redirect(tx, rx, BaudRate.BaudRate9600);

    if (!espState) {
      espState = {
        subscriptions: [],
        meetingId: "makerbit",
        groupId: 1,
      };

      control.inBackground(readSerialMessages);
    }

    // establish clean connection
    serial.writeString("----- -----\n");
    serial.writeString("----- -----\n");
  }

  export function sendNumber(value: number) {
    autoConnectToESP();
    send("num", "" + value);
  }

  export function sendString(value: string) {
    autoConnectToESP();
    send("str", value);
  }

  export function send(name: string, value: string) {
    autoConnectToESP();
    serial.writeString("pub ");
    serial.writeString(normalize(name));
    serial.writeString(' "');
    serial.writeString(value);
    serial.writeString('"');
    serial.writeString("\n");
  }

  export function setGroup(id: number) {
    autoConnectToESP();
    espState.groupId = id;
    updateMqttRoot();
  }

  export function setMeetingId(id: string) {
    autoConnectToESP();
    espState.meetingId = normalize(id);
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
