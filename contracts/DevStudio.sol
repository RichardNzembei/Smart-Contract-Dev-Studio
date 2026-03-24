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
        // H1: Budget-weighted reputation
        uint256 totalWeightedRating; // sum of (rating * budget) across all rated projects
        uint256 totalWeight;         // sum of budgets across all rated projects
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
    address public studio;
    uint256 public projectCount;
    bool private _locked;

    mapping(address => Developer) public developers;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => bool) public projectRated;
    mapping(uint256 => bool) public projectWithdrawn;
    mapping(uint256 => uint256) public projectFunded; // total ETH funded by clients per project

    // C1: Pull-based payment balances
    mapping(address => uint256) public pendingWithdrawals;

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
    event ProjectCompleted(uint256 indexed projectId);
    event ProjectCancelled(uint256 indexed projectId);
    event ProjectFunded(uint256 indexed projectId, address indexed funder, uint256 amount);
    event DeveloperPaid(uint256 indexed projectId, address indexed developer, uint256 milestoneIndex, uint256 amount);
    event UnclaimableWithdrawn(uint256 indexed projectId, uint256 amount);
    event Withdrawal(address indexed payee, uint256 amount);
    event DeveloperReassigned(uint256 indexed projectId, address indexed oldDeveloper, address indexed newDeveloper);
    event BudgetIncreased(uint256 indexed projectId, uint256 amount);
    event DeadlineExtended(uint256 indexed projectId, uint256 newDeadline);
    event MilestoneEdited(uint256 indexed projectId, uint256 milestoneIndex, string newTitle, uint256 newValue);
    event MilestoneRemoved(uint256 indexed projectId, uint256 milestoneIndex);

    // ──────────────────── Modifiers ────────────────────
    modifier onlyStudio() {
        require(msg.sender == studio, "Only studio can call this");
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

    // ──────────────────── Project Management ────────────────────
    function createProject(
        string calldata _title,
        string calldata _description,
        uint256 _deadline
    ) external payable onlyStudio {
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
            client: address(0),
            developer: address(0),
            status: ProjectStatus.Active,
            milestoneCount: 0,
            approvedCount: 0
        });

        emit ProjectCreated(projectId, _title, msg.value, _deadline);
    }

    // ──────────────────── Client Funding ────────────────────
    function fundProject(uint256 _projectId) external payable {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(msg.value > 0, "Must send ETH to fund");

        project.budget += msg.value;
        projectFunded[_projectId] += msg.value;

        // Track the first funder as the client
        if (project.client == address(0)) {
            project.client = msg.sender;
        }

        emit ProjectFunded(_projectId, msg.sender, msg.value);
    }

    // C4: Studio top-up budget (doesn't touch client field)
    function topUpBudget(uint256 _projectId) external payable onlyStudio {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(msg.value > 0, "Must send ETH");

        project.budget += msg.value;

        emit BudgetIncreased(_projectId, msg.value);
    }

    function addMilestone(
        uint256 _projectId,
        string calldata _title,
        uint256 _value,
        uint256 _deadline
    ) external onlyStudio {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(_value > 0, "Milestone value must be greater than 0");
        require(_deadline <= project.deadline, "Milestone deadline exceeds project deadline");

        uint256 milestoneIndex = project.milestoneCount;

        // Check total milestone values don't exceed budget
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

    // H2: Edit a pending milestone's title and/or value
    function editMilestone(
        uint256 _projectId,
        uint256 _milestoneIndex,
        string calldata _newTitle,
        uint256 _newValue
    ) external onlyStudio {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");

        Milestone storage milestone = milestones[_projectId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Pending, "Can only edit pending milestones");
        require(milestone.value > 0, "Milestone does not exist");
        require(_newValue > 0, "Value must be greater than 0");

        // Check new total doesn't exceed budget
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

    // H2: Remove a pending milestone (sets value to 0, marks as removed)
    function removeMilestone(uint256 _projectId, uint256 _milestoneIndex) external onlyStudio {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");

        Milestone storage milestone = milestones[_projectId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Pending, "Can only remove pending milestones");
        require(milestone.value > 0, "Milestone does not exist or already removed");

        milestone.value = 0;
        milestone.title = "";
        project.milestoneCount--;

        emit MilestoneRemoved(_projectId, _milestoneIndex);
    }

    // H4: Extend project and milestone deadlines
    function extendDeadline(uint256 _projectId, uint256 _newDeadline) external onlyStudio {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(_newDeadline > project.deadline, "New deadline must be later than current");

        project.deadline = _newDeadline;

        emit DeadlineExtended(_projectId, _newDeadline);
    }

    function assignDeveloper(uint256 _projectId, address _developer) external onlyStudio {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer == address(0), "Developer already assigned");
        require(developers[_developer].registered, "Developer not registered");

        project.developer = _developer;

        emit DeveloperAssigned(_projectId, _developer);
    }

    // C3: Reassign developer on active projects
    function reassignDeveloper(uint256 _projectId, address _newDeveloper) external onlyStudio {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer != address(0), "No developer assigned");
        require(_newDeveloper != project.developer, "Same developer");
        require(developers[_newDeveloper].registered, "New developer not registered");

        // Ensure no milestones are in Submitted state (pending review)
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

    // C1: Refactored to credit pendingWithdrawals instead of pushing ETH
    function approveMilestone(uint256 _projectId, uint256 _milestoneIndex) external onlyStudio nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer != address(0), "No developer assigned");

        Milestone storage milestone = milestones[_projectId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Submitted, "Milestone not submitted");

        milestone.status = MilestoneStatus.Approved;
        project.approvedCount++;

        // Credit developer's withdrawal balance (pull pattern)
        pendingWithdrawals[project.developer] += milestone.value;

        emit MilestoneApproved(_projectId, _milestoneIndex, milestone.value);
        emit DeveloperPaid(_projectId, project.developer, _milestoneIndex, milestone.value);

        // Check if all milestones are approved
        if (project.approvedCount == project.milestoneCount) {
            project.status = ProjectStatus.Completed;
            emit ProjectCompleted(_projectId);
        }
    }

    // C5: Batch approve multiple milestones in one transaction
    function batchApproveMilestones(uint256 _projectId, uint256[] calldata _milestoneIndices) external onlyStudio nonReentrant {
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

        if (project.approvedCount == project.milestoneCount) {
            project.status = ProjectStatus.Completed;
            emit ProjectCompleted(_projectId);
        }
    }

    // C1: Pull-based withdrawal for developers (and anyone with a pending balance)
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdrawal failed");

        emit Withdrawal(msg.sender, amount);
    }

    // ──────────────────── Disputes ────────────────────
    function raiseDispute(uint256 _projectId) external {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(
            msg.sender == studio || msg.sender == project.developer || msg.sender == project.client,
            "Only studio, developer, or client can raise dispute"
        );

        project.status = ProjectStatus.Disputed;

        emit DisputeRaised(_projectId, msg.sender);
    }

    // C1 + C2: Refactored for pull payments and proportional refunds
    function resolveDispute(uint256 _projectId, bool _inFavorOfDeveloper) external onlyStudio nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Disputed, "Project is not disputed");

        if (_inFavorOfDeveloper) {
            // Credit developer for all submitted (but unapproved) milestones
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
            // C2: Proportional refund to studio and client
            uint256 paidOut = 0;
            for (uint256 i = 0; i < project.milestoneCount; i++) {
                if (milestones[_projectId][i].status == MilestoneStatus.Approved) {
                    paidOut += milestones[_projectId][i].value;
                }
            }
            uint256 refund = project.budget - paidOut;
            if (refund > 0) {
                uint256 clientContribution = projectFunded[_projectId];
                if (clientContribution > 0 && project.client != address(0)) {
                    // Calculate proportional shares
                    uint256 clientShare = (refund * clientContribution) / project.budget;
                    uint256 studioShare = refund - clientShare;

                    if (clientShare > 0) {
                        pendingWithdrawals[project.client] += clientShare;
                    }
                    if (studioShare > 0) {
                        pendingWithdrawals[studio] += studioShare;
                    }
                } else {
                    // No client funding — all goes to studio
                    pendingWithdrawals[studio] += refund;
                }
            }
            project.status = ProjectStatus.Cancelled;
        }

        emit DisputeResolved(_projectId, _inFavorOfDeveloper);
    }

    // ──────────────────── Reputation ────────────────────
    function rateDeveloper(uint256 _projectId, uint8 _rating) external onlyStudio {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Completed, "Project not completed");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1-5");
        require(project.developer != address(0), "No developer assigned");
        require(!projectRated[_projectId], "Already rated");

        projectRated[_projectId] = true;

        Developer storage dev = developers[project.developer];
        dev.totalRating += _rating;
        dev.ratingCount++;

        // H1: Budget-weighted reputation
        dev.totalWeightedRating += uint256(_rating) * project.budget;
        dev.totalWeight += project.budget;

        emit DeveloperRated(project.developer, _projectId, _rating);
    }

    // ──────────────────── Project Cancellation ────────────────────
    // C2: Proportional refund on cancellation
    function cancelProject(uint256 _projectId) external onlyStudio nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.approvedCount == 0, "Milestones already approved");

        project.status = ProjectStatus.Cancelled;

        // Proportional refund
        uint256 clientContribution = projectFunded[_projectId];
        if (clientContribution > 0 && project.client != address(0)) {
            uint256 clientShare = (project.budget * clientContribution) / project.budget;
            uint256 studioShare = project.budget - clientShare;

            if (clientShare > 0) {
                pendingWithdrawals[project.client] += clientShare;
            }
            if (studioShare > 0) {
                pendingWithdrawals[studio] += studioShare;
            }
        } else {
            pendingWithdrawals[studio] += project.budget;
        }

        emit ProjectCancelled(_projectId);
    }

    // ──────────────────── Withdraw Unclaimable Funds ────────────────────
    function withdrawUnclaimable(uint256 _projectId) external onlyStudio nonReentrant {
        Project storage project = projects[_projectId];
        require(
            project.status == ProjectStatus.Completed || project.status == ProjectStatus.Cancelled,
            "Project must be completed or cancelled"
        );
        require(!projectWithdrawn[_projectId], "Already withdrawn");

        uint256 paidOut = 0;
        for (uint256 i = 0; i < project.milestoneCount; i++) {
            if (milestones[_projectId][i].status == MilestoneStatus.Approved) {
                paidOut += milestones[_projectId][i].value;
            }
        }

        uint256 remaining = project.budget - paidOut;
        require(remaining > 0, "No funds to withdraw");

        projectWithdrawn[_projectId] = true;

        // Credit to studio's pending withdrawal (pull pattern)
        pendingWithdrawals[studio] += remaining;

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

        for (uint256 i = 0; i < project.milestoneCount; i++) {
            if (milestones[_projectId][i].status == MilestoneStatus.Approved) {
                paidToDev += milestones[_projectId][i].value;
            }
        }
        remaining = totalBudget - paidToDev;
    }

    function getDeveloperRating(address _wallet) external view returns (uint256 average, uint256 count) {
        Developer storage dev = developers[_wallet];
        if (dev.ratingCount == 0) return (0, 0);
        return (dev.totalRating / dev.ratingCount, dev.ratingCount);
    }

    // H1: Budget-weighted reputation (large projects count more)
    function getWeightedRating(address _wallet) external view returns (uint256 weightedAverage, uint256 totalWeight, uint256 count) {
        Developer storage dev = developers[_wallet];
        if (dev.totalWeight == 0) return (0, 0, 0);
        return (dev.totalWeightedRating / dev.totalWeight, dev.totalWeight, dev.ratingCount);
    }
}
