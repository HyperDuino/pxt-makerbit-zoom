namespace pxtsim.makerbit {
  
  export function onReceivedNameValue(
    name: string,
    handler: (value: string) => void
  ) {
  }

  export function onReceivedString(handler: (receivedString: string) => void) {
  }

  export function onReceivedNumber(handler: (receivedNumber: number) => void) {
  }

  export function setWifi(ssid: string, pw: string) {
  }

  export function connectESP(tx: SerialPin, rx: SerialPin) {
  }

  export function sendNumber(value: number) {
  }

  export function sendString(value: string) {
  }

  export function send(name: string, value: string) {
  }

  export function setGroup(id: number) {
  }

  export function setMeetingId(id: string) {
  }

}
