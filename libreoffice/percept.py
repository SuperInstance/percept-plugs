# percept.py — LibreOffice-compatible Python port of the delta-shape percept core.
# Integer-exact mirror of SuperInstance/delta-shape @ e2ad00d5 (see core/VENDORED-FROM).
# JS-to-Python semantics pinned in test/plugs.pins.mjs: `|0` truncates toward zero
# (math.trunc, never //), s==0 maps to mag 0 (JS Infinity|0), upper median for
# even windows, floorLog2 = bit_length-1.

from math import trunc

FNV64_OFFSET = 0xCBF29CE484222325
FNV64_PRIME = 0x100000001B3
MASK64 = 0xFFFFFFFFFFFFFFFF


def floor_log2(n):
    return None if n <= 0 else n.bit_length() - 1


def _upper_median(win):
    s = sorted(win)
    return s[len(s) >> 1]


def surround(series, i, w=4):
    if i == 0:
        return None
    return _upper_median(series[max(0, i - w):i])


def percept(series, i, w=4, scale=1024):
    s = surround(series, i, w)
    if s is None:
        return {"level": None, "signed": 0}
    d = series[i] - s
    if d == 0:
        return {"level": None, "signed": 0}
    mag = trunc(abs(d) * scale / s) if s != 0 else 0  # JS: ((|d|*scale)/s)|0 ; x/0 -> Inf|0 = 0
    if mag == 0:
        return {"level": 0, "signed": (d > 0) - (d < 0)}
    return {"level": floor_log2(mag), "signed": (d > 0) - (d < 0)}


def perceive(series, w=4, scale=1024):
    return [{"i": i, **percept(series, i, w, scale)} for i in range(len(series))]


def diffs(xs):
    return [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]


def slope_class(d):
    return "+" if d > 0 else "-" if d < 0 else "0"


def shape_of(xs):
    return "".join(slope_class(d) for d in diffs(xs))


def change_points(xs):
    s = shape_of(xs)
    return [i for i in range(1, len(s)) if s[i] != s[i - 1]]


def first_crossing(xs, k):
    for i, v in enumerate(xs):
        if v >= k:
            return i
    return None


def eta(space_units, units_per_tick):
    if units_per_tick <= 0:
        return None
    return -(-space_units // units_per_tick)  # ceil division on ints


def cp_hash(cps):
    h = FNV64_OFFSET
    for c in cps:
        h ^= (c + 1) & MASK64
        h = (h * FNV64_PRIME) & MASK64
    return format(h, "016x")


def SHAPEOF(series):
    xs = [int(v) for v in series]
    return f"{shape_of(xs)} {cp_hash(change_points(xs))}"


def PERCEPTS(series, w=4):
    return [-1 if p["level"] is None else p["level"] for p in perceive([int(v) for v in series], w)]


def ETA(series, target, units_per_tick):
    xs = [int(v) for v in series]
    return eta(max(0, int(target) - xs[-1]), int(units_per_tick))


def DRIFTALARM(series, num, den):
    xs = [int(v) for v in series]
    for i in range(1, len(xs)):
        if abs(xs[i] - xs[i - 1]) * int(den) > abs(xs[i - 1]) * int(num):
            return i
    return -1


# --- LibreOffice UNO entry points (SHAPED: registered via Tools > Macros; the
# pure functions above are HEWN under node --test, the UNO glue needs LO). ---
def lo_shapeof(*args):
    ctx = __import__("uno").getComponentContext()  # noqa: F401  (available inside LO)
    return SHAPEOF(args[0])
