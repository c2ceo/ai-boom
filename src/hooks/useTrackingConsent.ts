import { useState, useCallback } from "react";

const ANALYTICS_KEY = "tracking_analytics_consent";
const ACTIVITY_KEY = "tracking_activity_consent";

export type TrackingConsent = {
  analytics: boolean;
  activity: boolean;
};

export const getTrackingConsent = (): TrackingConsent => ({
  analytics: localStorage.getItem(ANALYTICS_KEY) === "true",
  activity: localStorage.getItem(ACTIVITY_KEY) === "true",
});

export const useTrackingConsent = () => {
  const [consent, setConsent] = useState<TrackingConsent>(getTrackingConsent);

  const setAnalyticsConsent = useCallback((enabled: boolean) => {
    localStorage.setItem(ANALYTICS_KEY, String(enabled));
    setConsent((prev) => ({ ...prev, analytics: enabled }));
  }, []);

  const setActivityConsent = useCallback((enabled: boolean) => {
    localStorage.setItem(ACTIVITY_KEY, String(enabled));
    setConsent((prev) => ({ ...prev, activity: enabled }));
  }, []);

  return { consent, setAnalyticsConsent, setActivityConsent };
};
