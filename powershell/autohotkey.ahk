#Requires AutoHotkey v2.0

+#h::
{
    Run "C:\Users\khai.tran\AppData\Local\VirtualDesktop\move-desktop-to-left.bat"
}

+#l::
{
    Run "C:\Users\khai.tran\AppData\Local\VirtualDesktop\move-desktop-to-right.bat"
}

^#h::
{
    SendInput "^#{Left}"
}

^#l::
{
    SendInput "^#{Right}"
}

^Delete::
{
    SendInput "{Home}"
}

^Insert::
{
    SendInput "{Home}"
}

return
