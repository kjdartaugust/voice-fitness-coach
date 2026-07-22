import { describe, it, expect } from 'vitest';
import {
  toUnit, toMetres, paceToUnit, paceToSPerKm, speedFromPace, paceFromSpeed, M_PER_MI,
} from './units';
import { fmtDistUnit, fmtPaceUnit, fmtSpeedUnit } from './format';

describe('distance conversion', () => {
  it('km is the identity', () => {
    expect(toUnit(5000, 'km')).toBe(5);
    expect(toMetres(5, 'km')).toBe(5000);
  });
  it('one mile is 1609.344 m', () => {
    expect(toMetres(1, 'mi')).toBeCloseTo(M_PER_MI, 6);
    expect(toUnit(M_PER_MI, 'mi')).toBeCloseTo(1, 9);
  });
  it('5 km reads as ~3.11 mi', () => {
    expect(fmtDistUnit(5000, 'mi')).toBe('3.11');
  });
  it('round-trips through metres for both units', () => {
    for (const u of ['km', 'mi'] as const) {
      expect(toUnit(toMetres(7.5, u), u)).toBeCloseTo(7.5, 9);
    }
  });
});

describe('pace conversion', () => {
  it('km is the identity', () => {
    expect(paceToUnit(300, 'km')).toBe(300);
  });
  it('5:00/km is ~8:03/mi', () => {
    // a mile takes ~1.609x longer than a km at the same speed
    expect(fmtPaceUnit(300, 'mi')).toBe('8:03');
  });
  it('round-trips through s/km for both units', () => {
    for (const u of ['km', 'mi'] as const) {
      expect(paceToSPerKm(paceToUnit(330, u), u)).toBeCloseTo(330, 9);
    }
  });
});

describe('speed conversion (cycling)', () => {
  it('4:00/km is 15 km/h', () => {
    expect(speedFromPace(240, 'km')).toBeCloseTo(15, 6);
    expect(fmtSpeedUnit(240, 'km')).toBe('15.0');
  });
  it('24 km/h round-trips to ~2:30/km', () => {
    const sPerKm = paceFromSpeed(24, 'km');
    expect(sPerKm).toBeCloseTo(150, 6);
    expect(speedFromPace(sPerKm, 'km')).toBeCloseTo(24, 6);
  });
  it('reports mph when the unit is miles', () => {
    // 15 km/h ≈ 9.32 mph
    expect(speedFromPace(240, 'mi')).toBeCloseTo(9.32, 2);
  });
});
