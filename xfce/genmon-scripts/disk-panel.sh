#!/usr/bin/env bash

# Source: https://github.com/xtonousou/xfce4-genmon-scripts

# Dependencies: bash>=3.2, bleachbit(optional), coreutils, file, gawk, hddtemp, bc
# Default with XUbuntu: not need to install

# Makes the script more portable
readonly DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Optional icon to display before the text
# Insert the absolute path of the icon
# Recommended size is 24x24 px
readonly ICON="${DIR}/icons/disk/database.png"

# To determine if colors are applied
OVERHEAT=0

# Panel
INFO=""
if hash bleachbit &> /dev/null; then
  INFO+="<click>bleachbit &> /dev/null</click>"
elif hash gparted &> /dev/null; then
  INFO+="<click>gparted &> /dev/null</click>"
fi

if [[ $(file -b "${ICON}") =~ PNG|SVG ]]; then
  INFO+="<img>${ICON}</img>"
fi


USED_SPACE=$(awk '{$1 = $1 / 1048576; printf "%.2f", $1}' <<< $(df / | awk '/\/dev/{print $3}'))
USED_SPACE=$(echo "$USED_SPACE" | sed 's/,/./g')
TOTAL_SPACE=$(awk '{$1 = $1 / 1048576; printf "%.2f", $1}' <<< $(df / | awk '/\/dev/{print $2}'))
TOTAL_SPACE=$(echo "$TOTAL_SPACE" | sed 's/,/./g')

PERCENTAGE=$(echo $(echo "${USED_SPACE} * 100" | bc -l) / "${TOTAL_SPACE}" | bc -l)
PERCENTAGE_INT=$(echo "${PERCENTAGE}" | awk -F. '{print $1}')


# Percentage bar
BAR="<txt>${USED_SPACE} / ${TOTAL_SPACE} GB</txt>"

# Panel Print
echo -e "${INFO}"

# Bar print
echo -e "${BAR}"
