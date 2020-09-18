namespace makerbit {
    let _subscriptions: Subscription[] = undefined;
  
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
      if (!_subscriptions) return;
  
      const nameValue = splitNameValue(message);
  
      for (let i = 0; i < _subscriptions.length; ++i) {
        const sub = _subscriptions[i];
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
        this.name = name.replaceAll(" ", "_");
        serial.writeLine("sub " + this.name);
        this.handler = handler;
      }
    }
  
    export function onReceivedNameValue(
      name: string,
      handler: (value: string) => void
    ) {
      if (!_subscriptions) {
        _subscriptions = [];
      }
      _subscriptions.push(new Subscription(name, handler));
    }
  
    export function onReceivedString(handler: (receivedString: string) => void) {
      if (!_subscriptions) {
        _subscriptions = [];
      }
      _subscriptions.push(new Subscription("str", handler));
    }
  
    export function onReceivedNumber(handler: (receivedNumber: number) => void) {
      if (!_subscriptions) {
        _subscriptions = [];
      }
      _subscriptions.push(new Subscription("num", handler));
    }
  
    /**
     * Configure WiFi
     */
    //% block="Initialize ESP8266|Wifi SSID = %ssid|Wifi PW = %pw"
    //% ssid.defl=your_ssid
    //% pw.defl=your_pw
    export function setWifi(ssid: string, pw: string) {
      serial.writeLine('wifi "' + ssid + '" "' + pw + '"');
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
  
      control.inBackground(readSerialMessages);
  
      // establish clean connection
      serial.writeLine("----- -----");
      serial.writeLine("----- -----");
    }
  
    export function sendNumber(value: number) {
      send("num", "" + value);
    }
  
    export function sendString(value: string) {
      send("str", value);
    }
  
    export function send(name: string, value: string) {
      serial.writeString("pub ");
      serial.writeString(name.replaceAll(" ", "_"));
      serial.writeString(' "');
      serial.writeString(value);
      serial.writeString('"');
      serial.writeLine("");
    }
  }
  
  
  