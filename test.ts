makerbit.connectESP(SerialPin.P0,SerialPin.P1)
makerbit.setWifi("network", "secret")
makerbit.setMeeting("123-456-789-0")
makerbit.setGroup(1)
makerbit.setMeetingRoom("123-456-789-0", 1)

makerbit.onReceivedString(function (value: string) {})
makerbit.onReceivedNumber(function (value: number) {})
makerbit.onReceivedNameValue("counter", function (value: number) {})