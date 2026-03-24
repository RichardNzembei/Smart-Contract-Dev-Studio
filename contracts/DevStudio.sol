// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DevStudio {
    // ──────────────────── Enums ────────────────────
    enum ProjectStatus {
        Active,
        Completed,
        Disputed,
        Cancelled
    }

    enum MilestoneStatus {
        Pending,
        Submitted,
        Approved,
        Disputed
    }

    // ──────────────────── Structs ────────────────────
    struct Developer {
        address wallet;
        string name;
        uint256 totalRating;
        uint256 ratingCount;
        bool registered;
        uint256 totalWeightedRating;
        uint256 totalWeight;
    }

    struct Milestone {
        string title;
        uint256 value;
        uint256 deadline;
        MilestoneStatus status;
    }

    struct Project {
        uint256 id;
        string title;
        string description;
        uint256 budget;
        uint256 deadline;
        address client;
        address developer;
        ProjectStatus status;
        uint256 milestoneCount;
        uint256 approvedCount;
    }

    // ──────────────────── State ────────────────────
    address public studio; // Platform arbitrator only
    uint256 public projectCount;
    bool private _locked;

    mapping(address => Developer) public developers;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => bool) public projectRated;
    mapping(uint256 => bool) public projectWithdrawn;
    mapping(uint256 => uint256) public projectFunded;

    mapping(address => uint256) public pendingWithdrawals;
    mapping(uint256 => uint256) public removedMilestoneCount;
    mapping(uint256 => address) public disputeRaisedBy;

    uint256 public studioTotalRating;
    uint256 public studioRatingCount;
    mapping(uint256 => bool) public projectStudioRated;

    mapping(uint256 => uint256) public projectFundingCap;
    mapping(uint256 => mapping(address => uint256)) public funderContributions;
    mapping(uint256 => address[]) internal _projectFunders;
    mapping(uint256 => address) public proposedDeveloper;

    // ──────────────────── Events ────────────────────
    event DeveloperRegistered(address indexed wallet, string name);
    event ProjectCreated(uint256 indexed projectId, string title, uint256 budget, uint256 deadline);
    event MilestoneAdded(uint256 indexed projectId, uint256 milestoneIndex, string title, uint256 value, uint256 deadline);
    event DeveloperAssigned(uint256 indexed projectId, address indexed developer);
    event MilestoneSubmitted(uint256 indexed projectId, uint256 milestoneIndex);
    event MilestoneApproved(uint256 indexed projectId, uint256 milestoneIndex, uint256 value);
    event DisputeRaised(uint256 indexed projectId, address indexed raisedBy);
    event DisputeResolved(uint256 indexed projectId, bool inFavorOfDeveloper);
    event DeveloperRated(address indexed developer, uint256 indexed projectId, uint8 rating);
    event StudioRated(uint256 indexed projectId, address indexed developer, uint8 rating);
    event ProjectCompleted(uint256 indexed projectId);
    event ProjectCancelled(uint256 indexed projectId);
    event ProjectExpired(uint256 indexed projectId);
    event ProjectFunded(uint256 indexed projectId, address indexed funder, uint256 amount);
    event DeveloperPaid(uint256 indexed projectId, address indexed developer, uint256 milestoneIndex, uint256 amount);
    event UnclaimableWithdrawn(uint256 indexed projectId, uint256 amount);
    event Withdrawal(address indexed payee, uint256 amount);
    event DeveloperReassigned(uint256 indexed projectId, address indexed oldDeveloper, address indexed newDeveloper);
    event BudgetIncreased(uint256 indexed projectId, uint256 amount);
    event DeadlineExtended(uint256 indexed projectId, uint256 newDeadline);
    event MilestoneDeadlineExtended(uint256 indexed projectId, uint256 milestoneIndex, uint256 newDeadline);
    event MilestoneEdited(uint256 indexed projectId, uint256 milestoneIndex, string newTitle, uint256 newValue);
    event MilestoneRemoved(uint256 indexed projectId, uint256 milestoneIndex);
    event DeveloperProposed(uint256 indexed projectId, address indexed developer);
    event DeveloperAccepted(uint256 indexed projectId, address indexed developer);
    event DeveloperRejected(uint256 indexed projectId, address indexed developer);
    event FundingCapSet(uint256 indexed projectId, uint256 cap);

    // ──────────────────── Modifiers ────────────────────
    modifier onlyStudio() {
        require(msg.sender == studio, "Only studio can call this");
        _;
    }

    modifier onlyClient(uint256 _projectId) {
        require(projects[_projectId].client == msg.sender, "Only project client can call this");
        _;
    }

    modifier onlyAssignedDev(uint256 _projectId) {
        require(projects[_projectId].developer == msg.sender, "Only assigned developer can call this");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    // ──────────────────── Constructor ────────────────────
    constructor() {
        studio = msg.sender;
    }

    // ──────────────────── Internal Helpers ────────────────────

    function _activeMilestoneCount(uint256 _projectId) internal view returns (uint256) {
        return projects[_projectId].milestoneCount - removedMilestoneCount[_projectId];
    }

    function _paidOut(uint256 _projectId) internal view returns (uint256 total) {
        Project storage project = projects[_projectId];
        for (uint256 i = 0; i < project.milestoneCount; i++) {
            if (milestones[_projectId][i].status == MilestoneStatus.Approved) {
                total += milestones[_projectId][i].value;
            }
        }
    }

    /// @dev Distributes refund proportionally to all funders
    function _distributeRefund(uint256 _projectId, uint256 refund) internal {
        Project storage project = projects[_projectId];
        uint256 totalFunded = projectFunded[_projectId];

        if (totalFunded > 0) {
            address[] storage funders = _projectFunders[_projectId];
            uint256 totalFunderShare = 0;
            for (uint256 i = 0; i < funders.length; i++) {
                uint256 contribution = funderContributions[_projectId][funders[i]];
                uint256 funderShare = (refund * contribution) / project.budget;
                if (funderShare > 0) {
                    pendingWithdrawals[funders[i]] += funderShare;
                    totalFunderShare += funderShare;
                }
            }
            // Any rounding dust goes to studio (platform)
            uint256 dust = refund - totalFunderShare;
            if (dust > 0) {
                pendingWithdrawals[studio] += dust;
            }
        } else {
            pendingWithdrawals[studio] += refund;
        }
    }

    // ──────────────────── Developer Registration ────────────────────
    function registerDeveloper(string calldata _name) external {
        require(!developers[msg.sender].registered, "Already registered");
        require(bytes(_name).length > 0, "Name cannot be empty");

        developers[msg.sender] = Developer({
            wallet: msg.sender,
            name: _name,
            totalRating: 0,
            ratingCount: 0,
            registered: true,
            totalWeightedRating: 0,
            totalWeight: 0
        });

        emit DeveloperRegistered(msg.sender, _name);
    }

    // ──────────────────── Project Creation (Client) ────────────────────
    // Anyone can create a project — the creator becomes the client
    function createProject(
        string calldata _title,
        string calldata _description,
        uint256 _deadline
    ) external payable {
        require(msg.value > 0, "Budget must be greater than 0");
        require(_deadline > block.timestamp, "Deadline must be in the future");
        require(bytes(_title).length > 0, "Title cannot be empty");

        uint256 projectId = projectCount;
        projectCount++;

        projects[projectId] = Project({
            id: projectId,
            title: _title,
            description: _description,
            budget: msg.value,
            deadline: _deadline,
            client: msg.sender,
            developer: address(0),
            status: ProjectStatus.Active,
            milestoneCount: 0,
            approvedCount: 0
        });

        // Track creator as initial funder
        _projectFunders[projectId].push(msg.sender);
        funderContributions[projectId][msg.sender] = msg.value;
        projectFunded[projectId] = msg.value;
        projectFundingCap[projectId] = msg.value;

        emit ProjectCreated(projectId, _title, msg.value, _deadline);
    }

    // ──────────────────── Additional Funding ────────────────────
    // Anyone can contribute additional funds to a project
    function fundProject(uint256 _projectId) external payable {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(msg.value > 0, "Must send ETH to fund");

        uint256 cap = projectFundingCap[_projectId];
        if (cap > 0) {
            require(projectFunded[_projectId] + msg.value <= cap, "Funding exceeds cap");
        }

        if (funderContributions[_projectId][msg.sender] == 0) {
            require(_projectFunders[_projectId].length < 10, "Max 10 funders per project");
            _projectFunders[_projectId].push(msg.sender);
        }
        funderContributions[_projectId][msg.sender] += msg.value;

        project.budget += msg.value;
        projectFunded[_projectId] += msg.value;

        emit ProjectFunded(_projectId, msg.sender, msg.value);
    }

    // Client sets funding cap for external contributions
    function setFundingCap(uint256 _projectId, uint256 _cap) external onlyClient(_projectId) {
        require(projects[_projectId].status == ProjectStatus.Active, "Project is not active");
        require(_cap >= projectFunded[_projectId], "Cap below already funded amount");
        projectFundingCap[_projectId] = _cap;
        emit FundingCapSet(_projectId, _cap);
    }

    // Client adds more funds to their project
    function topUpBudget(uint256 _projectId) external payable onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(msg.value > 0, "Must send ETH");

        project.budget += msg.value;

        // Track contribution for proportional refunds
        funderContributions[_projectId][msg.sender] += msg.value;
        projectFunded[_projectId] += msg.value;

        // Auto-raise cap if needed
        if (projectFundingCap[_projectId] < projectFunded[_projectId]) {
            projectFundingCap[_projectId] = projectFunded[_projectId];
        }

        emit BudgetIncreased(_projectId, msg.value);
    }

    // ──────────────────── Milestone Management (Client) ────────────────────

    function addMilestone(
        uint256 _projectId,
        string calldata _title,
        uint256 _value,
        uint256 _deadline
    ) external onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(_value > 0, "Milestone value must be greater than 0");
        require(_deadline <= project.deadline, "Milestone deadline exceeds project deadline");

        uint256 milestoneIndex = project.milestoneCount;

        uint256 totalMilestoneValue = _value;
        for (uint256 i = 0; i < milestoneIndex; i++) {
            totalMilestoneValue += milestones[_projectId][i].value;
        }
        require(totalMilestoneValue <= project.budget, "Total milestone values exceed budget");

        milestones[_projectId][milestoneIndex] = Milestone({
            title: _title,
            value: _value,
            deadline: _deadline,
            status: MilestoneStatus.Pending
        });

        project.milestoneCount++;

        emit MilestoneAdded(_projectId, milestoneIndex, _title, _value, _deadline);
    }

    // Edit a pending milestone — blocked after developer assigned
    function editMilestone(
        uint256 _projectId,
        uint256 _milestoneIndex,
        string calldata _newTitle,
        uint256 _newValue
    ) external onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer == address(0), "Cannot edit milestones after developer assigned");

        Milestone storage milestone = milestones[_projectId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Pending, "Can only edit pending milestones");
        require(milestone.value > 0, "Milestone does not exist");
        require(_newValue > 0, "Value must be greater than 0");

        uint256 totalMilestoneValue = 0;
        for (uint256 i = 0; i < project.milestoneCount; i++) {
            if (i == _milestoneIndex) {
                totalMilestoneValue += _newValue;
            } else {
                totalMilestoneValue += milestones[_projectId][i].value;
            }
        }
        require(totalMilestoneValue <= project.budget, "Total milestone values exceed budget");

        milestone.title = _newTitle;
        milestone.value = _newValue;

        emit MilestoneEdited(_projectId, _milestoneIndex, _newTitle, _newValue);
    }

    // Remove a pending milestone — blocked after developer assigned
    function removeMilestone(uint256 _projectId, uint256 _milestoneIndex) external onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer == address(0), "Cannot remove milestones after developer assigned");

        Milestone storage milestone = milestones[_projectId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Pending, "Can only remove pending milestones");
        require(milestone.value > 0, "Milestone does not exist or already removed");

        milestone.value = 0;
        milestone.title = "";
        removedMilestoneCount[_projectId]++;

        emit MilestoneRemoved(_projectId, _milestoneIndex);
    }

    // ──────────────────── Deadline Management (Client) ────────────────────

    function extendDeadline(uint256 _projectId, uint256 _newDeadline) external onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(_newDeadline > project.deadline, "New deadline must be later than current");

        project.deadline = _newDeadline;

        emit DeadlineExtended(_projectId, _newDeadline);
    }

    function extendMilestoneDeadline(
        uint256 _projectId,
        uint256 _milestoneIndex,
        uint256 _newDeadline
    ) external onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");

        Milestone storage milestone = milestones[_projectId][_milestoneIndex];
        require(milestone.value > 0, "Milestone does not exist");
        require(milestone.status == MilestoneStatus.Pending, "Can only extend pending milestones");
        require(_newDeadline > milestone.deadline, "New deadline must be later than current");
        require(_newDeadline <= project.deadline, "Milestone deadline exceeds project deadline");

        milestone.deadline = _newDeadline;

        emit MilestoneDeadlineExtended(_projectId, _milestoneIndex, _newDeadline);
    }

    // ──────────────────── Developer Assignment (Client) ────────────────────

    // Client proposes a developer (two-step)
    function proposeDeveloper(uint256 _projectId, address _developer) external onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer == address(0), "Developer already assigned");
        require(developers[_developer].registered, "Developer not registered");

        proposedDeveloper[_projectId] = _developer;

        emit DeveloperProposed(_projectId, _developer);
    }

    // Developer accepts the proposal
    function acceptAssignment(uint256 _projectId) external {
        require(proposedDeveloper[_projectId] == msg.sender, "Not proposed for this project");
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer == address(0), "Developer already assigned");

        project.developer = msg.sender;
        proposedDeveloper[_projectId] = address(0);

        emit DeveloperAccepted(_projectId, msg.sender);
        emit DeveloperAssigned(_projectId, msg.sender);
    }

    // Developer rejects the proposal
    function rejectAssignment(uint256 _projectId) external {
        require(proposedDeveloper[_projectId] == msg.sender, "Not proposed for this project");

        address dev = proposedDeveloper[_projectId];
        proposedDeveloper[_projectId] = address(0);

        emit DeveloperRejected(_projectId, dev);
    }

    // Client direct-assigns (skips proposal, for trusted developers)
    function assignDeveloper(uint256 _projectId, address _developer) external onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer == address(0), "Developer already assigned");
        require(developers[_developer].registered, "Developer not registered");

        project.developer = _developer;
        proposedDeveloper[_projectId] = address(0);

        emit DeveloperAssigned(_projectId, _developer);
    }

    // Client reassigns developer — requires no submitted milestones
    function reassignDeveloper(uint256 _projectId, address _newDeveloper) external onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer != address(0), "No developer assigned");
        require(_newDeveloper != project.developer, "Same developer");
        require(developers[_newDeveloper].registered, "New developer not registered");

        for (uint256 i = 0; i < project.milestoneCount; i++) {
            require(
                milestones[_projectId][i].status != MilestoneStatus.Submitted,
                "Cannot reassign: milestone pending review"
            );
        }

        address oldDev = project.developer;
        project.developer = _newDeveloper;

        emit DeveloperReassigned(_projectId, oldDev, _newDeveloper);
    }

    // ──────────────────── Milestone Workflow ────────────────────

    function submitMilestone(uint256 _projectId, uint256 _milestoneIndex) external onlyAssignedDev(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");

        Milestone storage milestone = milestones[_projectId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Pending, "Milestone not in pending state");
        require(milestone.value > 0, "Milestone does not exist");
        require(block.timestamp <= milestone.deadline, "Milestone deadline passed");

        milestone.status = MilestoneStatus.Submitted;

        emit MilestoneSubmitted(_projectId, _milestoneIndex);
    }

    // Client approves submitted milestone and releases payment to developer
    function approveMilestone(uint256 _projectId, uint256 _milestoneIndex) external onlyClient(_projectId) nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer != address(0), "No developer assigned");

        Milestone storage milestone = milestones[_projectId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Submitted, "Milestone not submitted");

        milestone.status = MilestoneStatus.Approved;
        project.approvedCount++;

        pendingWithdrawals[project.developer] += milestone.value;

        emit MilestoneApproved(_projectId, _milestoneIndex, milestone.value);
        emit DeveloperPaid(_projectId, project.developer, _milestoneIndex, milestone.value);

        if (project.approvedCount == _activeMilestoneCount(_projectId)) {
            project.status = ProjectStatus.Completed;
            emit ProjectCompleted(_projectId);
        }
    }

    // Client batch-approves multiple milestones
    function batchApproveMilestones(uint256 _projectId, uint256[] calldata _milestoneIndices) external onlyClient(_projectId) nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer != address(0), "No developer assigned");
        require(_milestoneIndices.length > 0, "No milestones specified");

        for (uint256 j = 0; j < _milestoneIndices.length; j++) {
            uint256 idx = _milestoneIndices[j];
            Milestone storage milestone = milestones[_projectId][idx];
            require(milestone.status == MilestoneStatus.Submitted, "Milestone not submitted");

            milestone.status = MilestoneStatus.Approved;
            project.approvedCount++;
            pendingWithdrawals[project.developer] += milestone.value;

            emit MilestoneApproved(_projectId, idx, milestone.value);
            emit DeveloperPaid(_projectId, project.developer, idx, milestone.value);
        }

        if (project.approvedCount == _activeMilestoneCount(_projectId)) {
            project.status = ProjectStatus.Completed;
            emit ProjectCompleted(_projectId);
        }
    }

    // Pull-based withdrawal for anyone with a pending balance
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdrawal failed");

        emit Withdrawal(msg.sender, amount);
    }

    // ──────────────────── Disputes (Studio = Arbitrator) ────────────────────

    function raiseDispute(uint256 _projectId) external {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(
            msg.sender == studio || msg.sender == project.developer || msg.sender == project.client,
            "Only studio, developer, or client can raise dispute"
        );

        project.status = ProjectStatus.Disputed;
        disputeRaisedBy[_projectId] = msg.sender;

        emit DisputeRaised(_projectId, msg.sender);
    }

    // Only studio (platform arbitrator) resolves disputes
    function resolveDispute(uint256 _projectId, bool _inFavorOfDeveloper) external onlyStudio nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Disputed, "Project is not disputed");

        if (disputeRaisedBy[_projectId] == studio && !_inFavorOfDeveloper) {
            revert("Studio cannot resolve self-raised dispute in own favor");
        }

        if (_inFavorOfDeveloper) {
            for (uint256 i = 0; i < project.milestoneCount; i++) {
                Milestone storage milestone = milestones[_projectId][i];
                if (milestone.status == MilestoneStatus.Submitted || milestone.status == MilestoneStatus.Disputed) {
                    milestone.status = MilestoneStatus.Approved;
                    project.approvedCount++;
                    pendingWithdrawals[project.developer] += milestone.value;
                }
            }
            project.status = ProjectStatus.Completed;
        } else {
            uint256 paidOut = _paidOut(_projectId);
            uint256 refund = project.budget - paidOut;
            if (refund > 0) {
                _distributeRefund(_projectId, refund);
            }
            project.status = ProjectStatus.Cancelled;
        }

        emit DisputeResolved(_projectId, _inFavorOfDeveloper);
    }

    // ──────────────────── Reputation ────────────────────

    // Client rates developer after project completion
    function rateDeveloper(uint256 _projectId, uint8 _rating) external onlyClient(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Completed, "Project not completed");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1-5");
        require(project.developer != address(0), "No developer assigned");
        require(!projectRated[_projectId], "Already rated");

        projectRated[_projectId] = true;

        Developer storage dev = developers[project.developer];
        dev.totalRating += _rating;
        dev.ratingCount++;
        dev.totalWeightedRating += uint256(_rating) * project.budget;
        dev.totalWeight += project.budget;

        emit DeveloperRated(project.developer, _projectId, _rating);
    }

    // Developer rates the platform experience
    function rateStudio(uint256 _projectId, uint8 _rating) external {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Completed, "Project not completed");
        require(msg.sender == project.developer, "Only assigned developer can rate studio");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1-5");
        require(!projectStudioRated[_projectId], "Already rated");

        projectStudioRated[_projectId] = true;
        studioTotalRating += _rating;
        studioRatingCount++;

        emit StudioRated(_projectId, msg.sender, _rating);
    }

    // ──────────────────── Project Cancellation (Client) ────────────────────

    // Client cancels their project (only if no milestones approved)
    function cancelProject(uint256 _projectId) external onlyClient(_projectId) nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.approvedCount == 0, "Milestones already approved");

        project.status = ProjectStatus.Cancelled;
        _distributeRefund(_projectId, project.budget);

        emit ProjectCancelled(_projectId);
    }

    // Studio (platform) expires overdue projects
    function expireProject(uint256 _projectId) external onlyStudio nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(block.timestamp > project.deadline, "Project not yet expired");

        project.status = ProjectStatus.Cancelled;

        uint256 paidOut = _paidOut(_projectId);
        uint256 refund = project.budget - paidOut;
        if (refund > 0) {
            _distributeRefund(_projectId, refund);
        }

        emit ProjectExpired(_projectId);
        emit ProjectCancelled(_projectId);
    }

    // ──────────────────── Withdraw Surplus Funds (Client) ────────────────────

    function withdrawUnclaimable(uint256 _projectId) external onlyClient(_projectId) nonReentrant {
        Project storage project = projects[_projectId];
        require(
            project.status == ProjectStatus.Completed || project.status == ProjectStatus.Cancelled,
            "Project must be completed or cancelled"
        );
        require(!projectWithdrawn[_projectId], "Already withdrawn");

        uint256 paidOut = _paidOut(_projectId);
        uint256 remaining = project.budget - paidOut;
        require(remaining > 0, "No funds to withdraw");

        projectWithdrawn[_projectId] = true;
        _distributeRefund(_projectId, remaining);

        emit UnclaimableWithdrawn(_projectId, remaining);
    }

    // ──────────────────── View Functions ────────────────────

    function getDeveloper(address _wallet) external view returns (Developer memory) {
        return developers[_wallet];
    }

    function getProject(uint256 _projectId) external view returns (Project memory) {
        return projects[_projectId];
    }

    function getMilestone(uint256 _projectId, uint256 _milestoneIndex) external view returns (Milestone memory) {
        return milestones[_projectId][_milestoneIndex];
    }

    function getProjectPayments(uint256 _projectId) external view returns (
        uint256 totalBudget,
        uint256 clientFunded,
        uint256 paidToDev,
        uint256 remaining
    ) {
        Project storage project = projects[_projectId];
        totalBudget = project.budget;
        clientFunded = projectFunded[_projectId];
        paidToDev = _paidOut(_projectId);
        remaining = totalBudget - paidToDev;
    }

    function getDeveloperRating(address _wallet) external view returns (uint256 average, uint256 count) {
        Developer storage dev = developers[_wallet];
        if (dev.ratingCount == 0) return (0, 0);
        return (dev.totalRating / dev.ratingCount, dev.ratingCount);
    }

    function getWeightedRating(address _wallet) external view returns (uint256 weightedAverage, uint256 totalWeight, uint256 count) {
        Developer storage dev = developers[_wallet];
        if (dev.totalWeight == 0) return (0, 0, 0);
        return (dev.totalWeightedRating / dev.totalWeight, dev.totalWeight, dev.ratingCount);
    }

    function getStudioRating() external view returns (uint256 average, uint256 count) {
        if (studioRatingCount == 0) return (0, 0);
        return (studioTotalRating / studioRatingCount, studioRatingCount);
    }

    function getDisputeRaiser(uint256 _projectId) external view returns (address) {
        return disputeRaisedBy[_projectId];
    }

    function getActiveMilestoneCount(uint256 _projectId) external view returns (uint256) {
        return _activeMilestoneCount(_projectId);
    }

    function getProjectFunders(uint256 _projectId) external view returns (address[] memory) {
        return _projectFunders[_projectId];
    }

    function getFunderContribution(uint256 _projectId, address _funder) external view returns (uint256) {
        return funderContributions[_projectId][_funder];
    }
}
