// SPDX-License-Identifier: UNLICENSED
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
            registered: true
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

    function assignDeveloper(uint256 _projectId, address _developer) external onlyStudio {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer == address(0), "Developer already assigned");
        require(developers[_developer].registered, "Developer not registered");

        project.developer = _developer;

        emit DeveloperAssigned(_projectId, _developer);
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

    function approveMilestone(uint256 _projectId, uint256 _milestoneIndex) external onlyStudio nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.developer != address(0), "No developer assigned");

        Milestone storage milestone = milestones[_projectId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Submitted, "Milestone not submitted");

        milestone.status = MilestoneStatus.Approved;
        project.approvedCount++;

        // Transfer ETH to developer
        (bool sent, ) = payable(project.developer).call{value: milestone.value}("");
        require(sent, "Payment failed");

        emit MilestoneApproved(_projectId, _milestoneIndex, milestone.value);
        emit DeveloperPaid(_projectId, project.developer, _milestoneIndex, milestone.value);

        // Check if all milestones are approved
        if (project.approvedCount == project.milestoneCount) {
            project.status = ProjectStatus.Completed;
            emit ProjectCompleted(_projectId);
        }
    }

    // ──────────────────── Disputes ────────────────────
    function raiseDispute(uint256 _projectId) external {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(
            msg.sender == studio || msg.sender == project.developer,
            "Only studio or assigned developer can raise dispute"
        );

        project.status = ProjectStatus.Disputed;

        emit DisputeRaised(_projectId, msg.sender);
    }

    function resolveDispute(uint256 _projectId, bool _inFavorOfDeveloper) external onlyStudio nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Disputed, "Project is not disputed");

        if (_inFavorOfDeveloper) {
            // Pay developer for all submitted (but unapproved) milestones
            for (uint256 i = 0; i < project.milestoneCount; i++) {
                Milestone storage milestone = milestones[_projectId][i];
                if (milestone.status == MilestoneStatus.Submitted || milestone.status == MilestoneStatus.Disputed) {
                    milestone.status = MilestoneStatus.Approved;
                    project.approvedCount++;
                    (bool sent, ) = payable(project.developer).call{value: milestone.value}("");
                    require(sent, "Payment failed");
                }
            }
            project.status = ProjectStatus.Completed;
        } else {
            // Refund remaining budget to studio
            uint256 paidOut = 0;
            for (uint256 i = 0; i < project.milestoneCount; i++) {
                if (milestones[_projectId][i].status == MilestoneStatus.Approved) {
                    paidOut += milestones[_projectId][i].value;
                }
            }
            uint256 refund = project.budget - paidOut;
            if (refund > 0) {
                (bool sent, ) = payable(studio).call{value: refund}("");
                require(sent, "Refund failed");
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

        emit DeveloperRated(project.developer, _projectId, _rating);
    }

    // ──────────────────── Project Cancellation ────────────────────
    function cancelProject(uint256 _projectId) external onlyStudio nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(project.approvedCount == 0, "Milestones already approved");

        project.status = ProjectStatus.Cancelled;

        (bool sent, ) = payable(studio).call{value: project.budget}("");
        require(sent, "Refund failed");

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

        (bool sent, ) = payable(studio).call{value: remaining}("");
        require(sent, "Withdrawal failed");

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
}
