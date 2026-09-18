import { rankWithTies } from "@/lib/apa/rank";
let fail = 0;
const check = (n: string, c: boolean, e?: unknown) => { if (!c) { fail++; console.log("FAIL:", n, JSON.stringify(e ?? "")); } };
const p = (pts: number[]) => rankWithTies(pts.map(v => ({ v })), r => r.v);

check("three-way tie at the top", JSON.stringify(p([1,1,1,0.5,0]).map(r=>r.rank)) === "[1,1,1,4,5]", p([1,1,1,0.5,0]).map(r=>r.rank));
check("tie flags set", JSON.stringify(p([1,1,1,0.5,0]).map(r=>r.tied)) === "[true,true,true,false,false]");
check("no ties", JSON.stringify(p([5,4,3]).map(r=>r.rank)) === "[1,2,3]");
check("tie in the middle", JSON.stringify(p([5,3,3,1]).map(r=>r.rank)) === "[1,2,2,4]", p([5,3,3,1]).map(r=>r.rank));
check("everyone on zero", JSON.stringify(p([0,0,0]).map(r=>r.rank)) === "[1,1,1]");
check("empty", p([]).length === 0);
check("single", JSON.stringify(p([2]).map(r=>[r.rank,r.tied])) === "[[1,false]]");
check("trailing tie", JSON.stringify(p([3,2,2]).map(r=>r.rank)) === "[1,2,2]");
console.log(fail === 0 ? "ALL RANK TESTS PASSED" : `${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
