makerbit.zoom.connectESP(SerialPin.P0,SerialPin.P1)
makerbit.zoom.connectWiFi("network", "secret")
makerbit.zoom.connectMeetingRoom("123-456-789-0", "1")

makerbit.zoom.sendNumber(1)
makerbit.zoom.sendString("hello world")
makerbit.zoom.sendScreenshot()
makerbit.zoom.sendNumberToChannel(23, 42)

makerbit.zoom.onReceivedString(function (value: string) {})
makerbit.zoom.onReceivedNumber(function (value: number) {})
makerbit.zoom.onReceivedScreenshot(function (screenshot: Image) {})
makerbit.zoom.onReceivedNumberInChannel(1, function (value: number) {})
