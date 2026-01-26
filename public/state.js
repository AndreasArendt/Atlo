export const state = {
  allActivities: [],
  displayActivities: [],
  displayGearIDs: [],
  currentActivityFilter: "All",
  activeSummaryStyle: "list",
  mapInstance: null,
  activeMapStyle: "bright",
  authPollTimer: null,
  currentPage: 1,
  expandedActivities: new Set(),
  rangePickerInstance: null,
  isAuthenticated: false,
  activityFilterHandlerBound: false,
  gearCache: new Map(),
  gearChartInstance: null,
  last7DaysActivities: [],
  last28DaysActivities: [],
  last7DaysSufferScore: [],
<<<<<<< Updated upstream
  last28DaysSufferScore: []
=======
  last28DaysSufferScore: [],
  maxSufferScore: 0,
  maxHeartRate: null,
  restingHeartRate: null,
  profileLoaded: false,
  trainingLoadActivities: [],
  yearlyGoals: [],
  yearlyGoalActivities: [],
  yearlyGoalYear: null,
  trainingLoad: {
    atl: 0,
    ctl: 0,
    ratio: null
  }
>>>>>>> Stashed changes
};
