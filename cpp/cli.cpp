// cpp/cli.cpp — differential-fuzz driver. Reads JSON-ish lines from stdin:
//   "S <n> <x0> <x1> ..."  -> prints: SHAPEOF | percepts csv | ETA target upt | DRIFTALARM num den
//   "E <target> <upt>" applies to the last S line (same series).
// Built by test/differential.mjs; also usable standalone.
#include "percept.hpp"
#include <iostream>
#include <sstream>

int main() {
  std::string line;
  std::vector<long long> cur;
  while (std::getline(std::cin, line)) {
    std::istringstream ss(line);
    char cmd; ss >> cmd;
    if (cmd == 'S') {
      size_t n; ss >> n; cur.clear();
      for (size_t i = 0; i < n; ++i) { long long x; ss >> x; cur.push_back(x); }
      auto ps = percept::PERCEPTS(cur, 4);
      std::cout << percept::SHAPEOF(cur) << " | ";
      for (size_t i = 0; i < ps.size(); ++i) { if (i) std::cout << ","; std::cout << ps[i]; }
      std::cout << "\n";
    } else if (cmd == 'E') {
      long long t, u, num, den; ss >> t >> u >> num >> den;
      std::cout << percept::ETA(cur, t, u) << " " << percept::DRIFTALARM(cur, num, den) << "\n";
    }
  }
  return 0;
}
