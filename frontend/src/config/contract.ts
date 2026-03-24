export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

// Human-readable ABI — ethers.js parses this natively
export const DEVSTUDIO_ABI = [
  // Constructor
  "constructor()",

  // Events
  "event BudgetIncreased(uint256 indexed projectId, uint256 amount)",
  "event DeadlineExtended(uint256 indexed projectId, uint256 newDeadline)",
  "event DeveloperAccepted(uint256 indexed projectId, address indexed developer)",
  "event DeveloperAssigned(uint256 indexed projectId, address indexed developer)",
  "event DeveloperPaid(uint256 indexed projectId, address indexed developer, uint256 milestoneIndex, uint256 amount)",
  "event DeveloperProposed(uint256 indexed projectId, address indexed developer)",
  "event DeveloperRated(address indexed developer, uint256 indexed projectId, uint8 rating)",
  "event DeveloperReassigned(uint256 indexed projectId, address indexed oldDeveloper, address indexed newDeveloper)",
  "event DeveloperRegistered(address indexed wallet, string name)",
  "event DeveloperRejected(uint256 indexed projectId, address indexed developer)",
  "event DisputeRaised(uint256 indexed projectId, address indexed raisedBy)",
  "event DisputeResolved(uint256 indexed projectId, bool inFavorOfDeveloper)",
  "event FundingCapSet(uint256 indexed projectId, uint256 cap)",
  "event MilestoneAdded(uint256 indexed projectId, uint256 milestoneIndex, string title, uint256 value, uint256 deadline)",
  "event MilestoneApproved(uint256 indexed projectId, uint256 milestoneIndex, uint256 value)",
  "event MilestoneDeadlineExtended(uint256 indexed projectId, uint256 milestoneIndex, uint256 newDeadline)",
  "event MilestoneEdited(uint256 indexed projectId, uint256 milestoneIndex, string newTitle, uint256 newValue)",
  "event MilestoneRemoved(uint256 indexed projectId, uint256 milestoneIndex)",
  "event MilestoneSubmitted(uint256 indexed projectId, uint256 milestoneIndex)",
  "event ProjectCancelled(uint256 indexed projectId)",
  "event ProjectCompleted(uint256 indexed projectId)",
  "event ProjectCreated(uint256 indexed projectId, string title, uint256 budget, uint256 deadline)",
  "event ProjectExpired(uint256 indexed projectId)",
  "event ProjectFunded(uint256 indexed projectId, address indexed funder, uint256 amount)",
  "event StudioRated(uint256 indexed projectId, address indexed developer, uint8 rating)",
  "event UnclaimableWithdrawn(uint256 indexed projectId, uint256 amount)",
  "event Withdrawal(address indexed payee, uint256 amount)",

  // State variables (auto-generated getters)
  "function studio() view returns (address)",
  "function projectCount() view returns (uint256)",
  "function developers(address) view returns (address wallet, string name, uint256 totalRating, uint256 ratingCount, bool registered, uint256 totalWeightedRating, uint256 totalWeight)",
  "function projects(uint256) view returns (uint256 id, string title, string description, uint256 budget, uint256 deadline, address client, address developer, uint8 status, uint256 milestoneCount, uint256 approvedCount)",
  "function milestones(uint256, uint256) view returns (string title, uint256 value, uint256 deadline, uint8 status)",
  "function projectRated(uint256) view returns (bool)",
  "function projectWithdrawn(uint256) view returns (bool)",
  "function projectFunded(uint256) view returns (uint256)",
  "function pendingWithdrawals(address) view returns (uint256)",
  "function removedMilestoneCount(uint256) view returns (uint256)",
  "function disputeRaisedBy(uint256) view returns (address)",
  "function studioTotalRating() view returns (uint256)",
  "function studioRatingCount() view returns (uint256)",
  "function projectStudioRated(uint256) view returns (bool)",
  "function projectFundingCap(uint256) view returns (uint256)",
  "function funderContributions(uint256, address) view returns (uint256)",
  "function proposedDeveloper(uint256) view returns (address)",

  // Developer Registration
  "function registerDeveloper(string _name)",

  // Project Management
  "function createProject(string _title, string _description, uint256 _deadline) payable",
  "function fundProject(uint256 _projectId) payable",
  "function setFundingCap(uint256 _projectId, uint256 _cap)",
  "function topUpBudget(uint256 _projectId) payable",
  "function addMilestone(uint256 _projectId, string _title, uint256 _value, uint256 _deadline)",
  "function editMilestone(uint256 _projectId, uint256 _milestoneIndex, string _newTitle, uint256 _newValue)",
  "function removeMilestone(uint256 _projectId, uint256 _milestoneIndex)",
  "function extendDeadline(uint256 _projectId, uint256 _newDeadline)",
  "function extendMilestoneDeadline(uint256 _projectId, uint256 _milestoneIndex, uint256 _newDeadline)",

  // Developer Assignment (two-step)
  "function proposeDeveloper(uint256 _projectId, address _developer)",
  "function acceptAssignment(uint256 _projectId)",
  "function rejectAssignment(uint256 _projectId)",
  "function assignDeveloper(uint256 _projectId, address _developer)",
  "function reassignDeveloper(uint256 _projectId, address _newDeveloper)",

  // Milestone Workflow
  "function submitMilestone(uint256 _projectId, uint256 _milestoneIndex)",
  "function approveMilestone(uint256 _projectId, uint256 _milestoneIndex)",
  "function batchApproveMilestones(uint256 _projectId, uint256[] _milestoneIndices)",

  // Withdrawal
  "function withdraw()",

  // Disputes
  "function raiseDispute(uint256 _projectId)",
  "function resolveDispute(uint256 _projectId, bool _inFavorOfDeveloper)",

  // Reputation
  "function rateDeveloper(uint256 _projectId, uint8 _rating)",
  "function rateStudio(uint256 _projectId, uint8 _rating)",

  // Cancellation / Expiry
  "function cancelProject(uint256 _projectId)",
  "function expireProject(uint256 _projectId)",
  "function withdrawUnclaimable(uint256 _projectId)",

  // View Functions
  "function getDeveloper(address _wallet) view returns (tuple(address wallet, string name, uint256 totalRating, uint256 ratingCount, bool registered, uint256 totalWeightedRating, uint256 totalWeight))",
  "function getProject(uint256 _projectId) view returns (tuple(uint256 id, string title, string description, uint256 budget, uint256 deadline, address client, address developer, uint8 status, uint256 milestoneCount, uint256 approvedCount))",
  "function getMilestone(uint256 _projectId, uint256 _milestoneIndex) view returns (tuple(string title, uint256 value, uint256 deadline, uint8 status))",
  "function getProjectPayments(uint256 _projectId) view returns (uint256 totalBudget, uint256 clientFunded, uint256 paidToDev, uint256 remaining)",
  "function getDeveloperRating(address _wallet) view returns (uint256 average, uint256 count)",
  "function getWeightedRating(address _wallet) view returns (uint256 weightedAverage, uint256 totalWeight, uint256 count)",
  "function getStudioRating() view returns (uint256 average, uint256 count)",
  "function getDisputeRaiser(uint256 _projectId) view returns (address)",
  "function getActiveMilestoneCount(uint256 _projectId) view returns (uint256)",
  "function getProjectFunders(uint256 _projectId) view returns (address[])",
  "function getFunderContribution(uint256 _projectId, address _funder) view returns (uint256)",
];
