import spiceypy as spice

print(spice.tkvrsn('TOOLKIT'))

spice.furnsh("./de430.bsp")
spice.furnsh("./latest_leapseconds.tls")
timstr = '2007 JAN 1 00:00:00'
et = spice.str2et(timstr)
print(spice.spkpos("moon", et, "J2000", "NONE", "earth"))
