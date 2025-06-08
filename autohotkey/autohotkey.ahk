; Requires AutoHotkey v2.0

+#h::
{
    Run "C:\Users\khai.tran\AppData\Local\VirtualDesktop\move-desktop-to-left.bat"
    Return
}

+#l::
{
    Run "C:\Users\khai.tran\AppData\Local\VirtualDesktop\move-desktop-to-right.bat"
    Return
}

#^h::
{
    SendInput "#^{Left}"
    Sleep 100  ; Small delay to let the desktop switch happen
    SendInput "!{Tab}"  ; Send Alt+Tab to focus on the active window
    SendInput "{Escape}"  ; Press Escape to close the Alt+Tab menu
    Return
}

#^l::
{
    SendInput "#^{Right}"
    Sleep 100
    SendInput "!{Tab}"
    SendInput "{Escape}"
    Return
}

!Delete::
{
    SendInput "{Home}"
    Return
}

^Insert::
{
    SendInput "{Home}"
    Return
}

Insert::
{
    SendInput "{Home}"
    Return
}

#^m::
{
    Send "{Volume_Mute}"
    Return
}

#^=::
{
    Send "{Volume_Up}"
    Return
}

#^-::
{
    Send "{Volume_Down}"
    Return
}

#^\::
{
    Send "{Media_Play_Pause}"
    Return
}

#^.::
{
    Send "{Media_Next}"
    Return
}

#^,::
{
    Send "{Media_Prev}"
    Return
}

return
