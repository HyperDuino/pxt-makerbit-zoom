makerbit.connectESP(SerialPin.P0,SerialPin.P1)
makerbit.connectWifi("network", "secret")
makerbit.connectMeetingRoom("123-456-789-0", "1")

makerbit.onReceivedString(function (value: string) {})
makerbit.onReceivedNumber(function (value: number) {})
makerbit.onReceivedScreenshot(function (screenshot: Image) {})
makerbit.onReceivedNumberInChannel(function (value: number) {}, 1)
