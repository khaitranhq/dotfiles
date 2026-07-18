import datetime
from kitty.fast_data_types import Screen, get_options
from kitty.tab_bar import (DrawData, ExtraData, TabBarData , as_rgb,
                           draw_tab_with_powerline)
from kitty.utils import color_as_int

opts = get_options()

ICON = " 󰄛 "
ICON_FG = as_rgb(int("2d353b", 16))
ICON_BG = as_rgb(int("a7c080", 16))

CLOCK_FG = as_rgb(int("ffffff", 16))
CLOCK_BG = as_rgb(color_as_int(opts.color4))
DATE_FG = as_rgb(int("ffffff", 16))
DATE_BG = as_rgb(color_as_int(opts.color4))

def _draw_right_status(screen: Screen, is_last: bool) -> int:
    if not is_last:
        return screen.cursor.x

    cells = [
        (CLOCK_BG, screen.cursor.bg, " ")
    ]

    right_status_length = 0
    for _, _, cell in cells:
        right_status_length += len(cell)

    draw_spaces = screen.columns - screen.cursor.x - right_status_length
    if draw_spaces > 0:
        screen.draw(" " * draw_spaces)

    for fg, bg, cell in cells:
        screen.cursor.fg = fg
        screen.cursor.bg = bg
        screen.draw(cell)
    screen.cursor.fg = 0
    screen.cursor.bg = 0

    screen.cursor.x = max(screen.cursor.x, screen.columns - right_status_length)
    return screen.cursor.x


def draw_tab(
    draw_data: DrawData,
    screen: Screen,
    tab: TabBarData,
    before: int,
    max_title_length: int,
    index: int,
    is_last: bool,
    extra_data: ExtraData,
) -> int:
    if index == 1:
        saved_fg, saved_bg = screen.cursor.fg, screen.cursor.bg
        screen.cursor.x = 0
        screen.cursor.fg = ICON_FG
        screen.cursor.bg = ICON_BG
        screen.draw(ICON)
        tab_bg = as_rgb(color_as_int(opts.active_tab_background)) if tab.is_active else as_rgb(color_as_int(opts.inactive_tab_background))
        screen.cursor.fg = ICON_BG
        screen.cursor.bg = tab_bg
        screen.draw("")
        screen.draw(" ")
        screen.cursor.fg, screen.cursor.bg = saved_fg, saved_bg
        before = len(ICON) + 2
    end = draw_tab_with_powerline(
        draw_data, screen, tab, before, max_title_length, index, is_last, extra_data
    )
    _draw_right_status(
        screen,
        is_last,
    )
    return end
