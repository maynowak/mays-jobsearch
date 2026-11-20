import type { CSSProperties } from "react";

type ParticleStyle = CSSProperties & Record<`--${string}`, string | number>;

const particles: Array<{ style: ParticleStyle }> = [
  { style: { left: "3%", top: "32%", "--size": "3px", "--color": "#22D3EE", "--opacity": 0.78, "--blur": "0px", "--dx": "34px", "--dy": "-48px", "--duration": "18s", "--delay": "-3s" } },
  { style: { left: "16%", top: "62%", "--size": "2px", "--color": "#67E8F9", "--opacity": 0.68, "--blur": "0.4px", "--dx": "-24px", "--dy": "-36px", "--duration": "16s", "--delay": "-11s" } },
  { style: { left: "23%", top: "36%", "--size": "4px", "--color": "#22D3EE", "--opacity": 0.72, "--blur": "1px", "--dx": "40px", "--dy": "22px", "--duration": "20s", "--delay": "-7s" } },
  { style: { left: "31%", top: "78%", "--size": "2px", "--color": "#A5F3FC", "--opacity": 0.86, "--blur": "0px", "--dx": "-30px", "--dy": "-42px", "--duration": "15s", "--delay": "-16s" } },
  { style: { left: "38%", top: "24%", "--size": "2px", "--color": "#67E8F9", "--opacity": 0.62, "--blur": "0.6px", "--dx": "26px", "--dy": "38px", "--duration": "19s", "--delay": "-1s" } },
  { style: { left: "46%", top: "68%", "--size": "3px", "--color": "#22D3EE", "--opacity": 0.78, "--blur": "0.3px", "--dx": "-38px", "--dy": "-22px", "--duration": "17s", "--delay": "-13s" } },
  { style: { left: "54%", top: "42%", "--size": "2px", "--color": "#67E8F9", "--opacity": 0.64, "--blur": "0.8px", "--dx": "32px", "--dy": "44px", "--duration": "21s", "--delay": "-5s" } },
  { style: { left: "61%", top: "15%", "--size": "4px", "--color": "#A5F3FC", "--opacity": 0.74, "--blur": "0.8px", "--dx": "-26px", "--dy": "32px", "--duration": "14s", "--delay": "-18s" } },
  { style: { left: "68%", top: "57%", "--size": "2px", "--color": "#22D3EE", "--opacity": 0.84, "--blur": "0px", "--dx": "38px", "--dy": "-28px", "--duration": "16s", "--delay": "-9s" } },
  { style: { left: "74%", top: "80%", "--size": "3px", "--color": "#67E8F9", "--opacity": 0.66, "--blur": "0.8px", "--dx": "-34px", "--dy": "-40px", "--duration": "22s", "--delay": "-15s" } },
  { style: { left: "82%", top: "30%", "--size": "2px", "--color": "#22D3EE", "--opacity": 0.76, "--blur": "0.2px", "--dx": "22px", "--dy": "36px", "--duration": "18s", "--delay": "-6s" } },
  { style: { left: "89%", top: "68%", "--size": "4px", "--color": "#A5F3FC", "--opacity": 0.70, "--blur": "1px", "--dx": "-30px", "--dy": "-34px", "--duration": "15s", "--delay": "-20s" } },
  { style: { left: "12%", top: "88%", "--size": "2px", "--color": "#67E8F9", "--opacity": 0.60, "--blur": "1px", "--dx": "28px", "--dy": "-20px", "--duration": "20s", "--delay": "-4s" } },
  { style: { left: "30%", top: "94%", "--size": "3px", "--color": "#22D3EE", "--opacity": 0.80, "--blur": "0.6px", "--dx": "-22px", "--dy": "-30px", "--duration": "17s", "--delay": "-12s" } },
  { style: { left: "55%", top: "93%", "--size": "2px", "--color": "#67E8F9", "--opacity": 0.72, "--blur": "0.3px", "--dx": "34px", "--dy": "26px", "--duration": "14s", "--delay": "-2s" } },
  { style: { left: "97%", top: "64%", "--size": "2px", "--color": "#22D3EE", "--opacity": 0.64, "--blur": "0.9px", "--dx": "-28px", "--dy": "28px", "--duration": "21s", "--delay": "-17s" } },
];

/** Decorative only: deterministic particles, no random React layout changes. */
export default function ProfileParticles() {
  return (
    <div className="profile-particles" aria-hidden="true">
      {particles.map((particle, index) => (
        <span key={index} style={particle.style} />
      ))}
    </div>
  );
}
