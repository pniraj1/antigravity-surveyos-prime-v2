import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createClaimSlice, type ClaimSlice } from '../claimSlice';
import { createVehicleSlice, type VehicleSlice } from '../vehicleSlice';
import { createBlankClaim } from '@/types';

type TestStore = ClaimSlice & VehicleSlice;

function makeStore() {
  return create<TestStore>()((...a) => ({
    ...createClaimSlice(...a),
    ...createVehicleSlice(...a),
  }));
}

describe('Inspection Fields Store Synchronization', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    store.setState({ currentClaim: createBlankClaim() });
  });

  describe('Survey / Inspection Date & Time synchronization', () => {
    it('1. updateAccident({ dateOfSurvey, timeOfSurvey }) syncs spotDetails.surveyDatetime and valuationDetails.inspectionDate', () => {
      store.getState().updateAccident({ dateOfSurvey: '2026-10-30', timeOfSurvey: '11:30' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.surveyDatetime).toBe('2026-10-30T11:30');
      expect(claim.valuationDetails.inspectionDate).toBe('2026-10-30T11:30');
    });

    it('2. updateSpotDetails({ surveyDatetime }) syncs accident.dateOfSurvey, accident.timeOfSurvey, and valuationDetails.inspectionDate', () => {
      store.getState().updateSpotDetails({ surveyDatetime: '2026-10-30T14:45' });

      const claim = store.getState().currentClaim!;
      expect(claim.accident.dateOfSurvey).toBe('2026-10-30');
      expect(claim.accident.timeOfSurvey).toBe('14:45');
      expect(claim.valuationDetails.inspectionDate).toBe('2026-10-30T14:45');
    });

    it('3. updateValuationDetails({ inspectionDate }) syncs accident.dateOfSurvey, accident.timeOfSurvey, and spotDetails.surveyDatetime', () => {
      store.getState().updateValuationDetails({ inspectionDate: '2026-10-30T09:15' });

      const claim = store.getState().currentClaim!;
      expect(claim.accident.dateOfSurvey).toBe('2026-10-30');
      expect(claim.accident.timeOfSurvey).toBe('09:15');
      expect(claim.spotDetails.surveyDatetime).toBe('2026-10-30T09:15');
    });

    it('handles dateOfSurvey set without timeOfSurvey', () => {
      store.getState().updateAccident({ dateOfSurvey: '2026-10-30', timeOfSurvey: '' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.surveyDatetime).toBe('2026-10-30');
      expect(claim.valuationDetails.inspectionDate).toBe('2026-10-30');
    });

    it('handles surveyDatetime with no time part (length 10)', () => {
      store.getState().updateSpotDetails({ surveyDatetime: '2026-10-30' });

      const claim = store.getState().currentClaim!;
      expect(claim.accident.dateOfSurvey).toBe('2026-10-30');
      expect(claim.accident.timeOfSurvey).toBe('');
      expect(claim.valuationDetails.inspectionDate).toBe('2026-10-30');
    });

    it('clears synced date/time fields when cleared', () => {
      store.getState().updateAccident({ dateOfSurvey: '2026-10-30', timeOfSurvey: '11:30' });
      store.getState().updateAccident({ dateOfSurvey: '', timeOfSurvey: '' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.surveyDatetime).toBe('');
      expect(claim.valuationDetails.inspectionDate).toBe('');
    });
  });

  describe('Place of Survey / Inspection synchronization', () => {
    it('4. updateAccident({ placeOfSurvey }) syncs valuationDetails.inspectionPlace', () => {
      store.getState().updateAccident({ placeOfSurvey: 'Sai Motors, Dhule' });

      const claim = store.getState().currentClaim!;
      expect(claim.valuationDetails.inspectionPlace).toBe('Sai Motors, Dhule');
    });

    it('5. updateValuationDetails({ inspectionPlace }) syncs accident.placeOfSurvey', () => {
      store.getState().updateValuationDetails({ inspectionPlace: 'Apex Garage, Nashik' });

      const claim = store.getState().currentClaim!;
      expect(claim.accident.placeOfSurvey).toBe('Apex Garage, Nashik');
    });

    it('clears place fields when cleared', () => {
      store.getState().updateAccident({ placeOfSurvey: 'Sai Motors, Dhule' });
      store.getState().updateAccident({ placeOfSurvey: '' });

      const claim = store.getState().currentClaim!;
      expect(claim.valuationDetails.inspectionPlace).toBe('');
    });
  });

  describe('Odometer synchronization', () => {
    it('6. updateVehicle({ odometer }) syncs valuationDetails.odometer', () => {
      store.getState().updateVehicle({ odometer: '45210' });

      const claim = store.getState().currentClaim!;
      expect(claim.valuationDetails.odometer).toBe('45210');
    });

    it('7. updateValuationDetails({ odometer }) syncs vehicle.odometer', () => {
      store.getState().updateValuationDetails({ odometer: '48300' });

      const claim = store.getState().currentClaim!;
      expect(claim.vehicle.odometer).toBe('48300');
    });

    it('clears odometer when cleared', () => {
      store.getState().updateVehicle({ odometer: '45210' });
      store.getState().updateVehicle({ odometer: '' });

      const claim = store.getState().currentClaim!;
      expect(claim.valuationDetails.odometer).toBe('');
    });
  });

  describe('Enclosures synchronization', () => {
    it('8. updateSpotDetails({ enclosures }) syncs valuationDetails.enclosures', () => {
      store.getState().updateSpotDetails({ enclosures: 'RC, DL, 12 photos' });

      const claim = store.getState().currentClaim!;
      expect(claim.valuationDetails.enclosures).toBe('RC, DL, 12 photos');
    });

    it('9. updateValuationDetails({ enclosures }) syncs spotDetails.enclosures', () => {
      store.getState().updateValuationDetails({ enclosures: 'Policy, RC, 8 photos' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.enclosures).toBe('Policy, RC, 8 photos');
    });

    it('clears enclosures when cleared', () => {
      store.getState().updateSpotDetails({ enclosures: 'RC, DL, 12 photos' });
      store.getState().updateSpotDetails({ enclosures: '' });

      const claim = store.getState().currentClaim!;
      expect(claim.valuationDetails.enclosures).toBe('');
    });
  });

  describe('Report Date and Allotment / Appointment Date synchronization', () => {
    it('10. updateSpotDetails({ reportDate }) syncs claim.reportDate', () => {
      store.getState().updateSpotDetails({ reportDate: '2026-11-05' });

      const claim = store.getState().currentClaim!;
      expect(claim.reportDate).toBe('2026-11-05');
    });

    it('11. updateSpotDetails({ allotmentDate }) syncs accident.appointmentDate', () => {
      store.getState().updateSpotDetails({ allotmentDate: '2026-10-28' });

      const claim = store.getState().currentClaim!;
      expect(claim.accident.appointmentDate).toBe('2026-10-28');
    });

    it('12. updateAccident({ appointmentDate }) syncs spotDetails.allotmentDate', () => {
      store.getState().updateAccident({ appointmentDate: '2026-10-27' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.allotmentDate).toBe('2026-10-27');
    });

    it('clears reportDate and appointment/allotmentDate when cleared', () => {
      store.getState().updateSpotDetails({ allotmentDate: '2026-10-28' });
      store.getState().updateSpotDetails({ allotmentDate: '' });

      const claim = store.getState().currentClaim!;
      expect(claim.accident.appointmentDate).toBe('');
    });

    it('syncs updateClaim({ reportDate }) to spotDetails.reportDate', () => {
      store.getState().updateClaim({ reportDate: '2026-11-10' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.reportDate).toBe('2026-11-10');
    });

    it('normalizes composite ISO datetime passed to updateAccident({ dateOfSurvey })', () => {
      store.getState().updateAccident({ dateOfSurvey: '2026-10-30T11:30:00' });

      const claim = store.getState().currentClaim!;
      expect(claim.accident.dateOfSurvey).toBe('2026-10-30');
      expect(claim.accident.timeOfSurvey).toBe('11:30');
      expect(claim.spotDetails.surveyDatetime).toBe('2026-10-30T11:30');
      expect(claim.valuationDetails.inspectionDate).toBe('2026-10-30T11:30');
    });

    it('truncates seconds in surveyDatetime to 5-char HH:mm timeOfSurvey', () => {
      store.getState().updateSpotDetails({ surveyDatetime: '2026-10-30T14:45:00.000Z' });

      const claim = store.getState().currentClaim!;
      expect(claim.accident.dateOfSurvey).toBe('2026-10-30');
      expect(claim.accident.timeOfSurvey).toBe('14:45');
    });
  });
});
