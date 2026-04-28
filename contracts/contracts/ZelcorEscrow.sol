// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ZelcorEscrow
 * @dev Smart contract for handling escrow payments and dispute resolution
 */
contract ZelcorEscrow is Ownable, ReentrancyGuard {
    // Transaction statuses
    enum Status {
        Pending,
        Completed,
        Disputed,
        Refunded,
        AutoRefunded
    }

    // Industry types supported by Zelcor
    enum Industry {
        Ecommerce,
        Insurance,
        Rental,
        EdTech,
        Hospital
    }

    // Insurance specific enums
    enum InsuranceUrgency {
        Normal,
        Critical,
        Emergency
    }

    enum InsuranceStatus {
        Pending,
        AiReviewed,
        InsurerApproved,
        InsurerRejected,
        PenaltyTriggered,
        AutoPaid,
        Resolved
    }

    // Rental specific enums
    enum RentalStatus {
        Pending,
        MoveInRecorded,
        Active,
        MoveOutRecorded,
        AiAssessed,
        Dispute,
        Resolved
    }

    // EdTech specific enums
    enum MilestoneStatus {
        Pending,
        InProgress,
        Completed,
        Frozen,
        Refunded
    }

    enum EdTechStatus {
        Pending,
        Enrolled,
        MilestoneBased,
        ComplaintFiled,
        RefundProcessed,
        Resolved
    }

    // Hospital specific enums
    enum HospitalStatus {
        Pending,
        PackageAgreed,
        TreatmentActive,
        ConsentRequired,
        Discharge,
        BillDisputed,
        Resolved
    }

    // ==================== INDUSTRY-SPECIFIC STRUCTURES ====================
    
    // Insurance Claim Structure
    struct InsuranceClaim {
        string claimId;
        address customer;
        address insurer;
        uint256 claimAmount;
        string diagnosis;
        InsuranceUrgency urgency;
        InsuranceStatus status;
        uint256 deadline;
        uint256 filedAt;
        string policyHash;
    }

    // Rental Agreement Structure
    struct RentalAgreement {
        string agreementId;
        address tenant;
        address landlord;
        uint256 totalDeposit;
        uint256 escrowAmount;
        uint256 moveInTimestamp;
        uint256 moveOutTimestamp;
        RentalStatus status;
        string propertyHash;
    }

    // EdTech Course Structure
    struct CourseEnrollment {
        string enrollmentId;
        address student;
        address platform;
        uint256 totalFee;
        uint256 releasedAmount;
        uint256 milestoneCount;
        EdTechStatus status;
        string courseHash;
    }

    // Hospital Package Structure
    struct HospitalPackage {
        string admissionId;
        address patient;
        address hospital;
        uint256 packageAmount;
        uint256 paidToHospital;
        uint256 heldInEscrow;
        HospitalStatus status;
        string packageHash;
    }

    // ==================== INDUSTRY MAPPINGS ====================
    
    mapping(string => InsuranceClaim) public insuranceClaims;
    mapping(string => RentalAgreement) public rentalAgreements;
    mapping(string => CourseEnrollment) public courseEnrollments;
    mapping(string => HospitalPackage) public hospitalPackages;

    // Industry-specific events
    event InsuranceClaimFiled(
        string indexed claimId,
        address indexed customer,
        uint256 amount,
        InsuranceUrgency urgency
    );
    
    event InsuranceUrgencyDetected(
        string indexed claimId,
        InsuranceUrgency urgency,
        uint256 deadline
    );

    event RentalMoveInRecorded(
        string indexed agreementId,
        address indexed tenant,
        uint256 depositEscrowed
    );

    event RentalMoveOutRecorded(
        string indexed agreementId,
        address indexed tenant
    );

    event RentalAiAssessment(
        string indexed agreementId,
        uint256 recommendedRefund,
        uint256 deduction
    );

    event CourseEnrolled(
        string indexed enrollmentId,
        address indexed student,
        uint256 amount
    );

    event MilestoneReleased(
        string indexed enrollmentId,
        uint8 milestone,
        uint256 amount
    );

    event CourseComplaintFiled(
        string indexed enrollmentId,
        address indexed student,
        uint8 validityScore
    );

    event HospitalPackageAgreed(
        string indexed admissionId,
        address indexed patient,
        uint256 packageAmount
    );

    event HospitalConsentGiven(
        string indexed admissionId,
        string item,
        uint256 amount
    );

    event HospitalBillDisputed(
        string indexed admissionId,
        uint256 disputedAmount,
        uint256 authorizedAmount
    );

    // Transaction structure
    struct Transaction {
        address customer;
        address company;
        uint256 amount;
        uint256 deadline;
        Status status;
        string transactionId;
        uint256 createdAt;
    }

    // Complaint structure
    struct Complaint {
        string transactionId;
        address customer;
        address company;
        string description;
        ComplaintCategory category;
        Urgency urgency;
        uint256 aiScore;
        bool aiApproved;
        string blockchainHash;
        uint256 filedAt;
    }

    // Company bond structure
    struct CompanyBond {
        address companyAddress;
        uint256 bondAmount;
        bool isCertified;
        uint256 trustScore;
    }

    // State variables
    mapping(string => Transaction) public transactions;
    mapping(string => Complaint) public complaints;
    mapping(address => CompanyBond) public companyBonds;
    
    uint256 public constant ESCROW_DURATION = 7 days;
    uint256 public constant COMPLAINT_WINDOW = 2 days;
    uint256 public constant AI_CONFIDENCE_THRESHOLD = 70;

    // Events
    event EscrowCreated(
        string indexed transactionId,
        address indexed customer,
        address indexed company,
        uint256 amount
    );
    
    event ReceiptConfirmed(string indexed transactionId);
    
    event ComplaintFiled(
        string indexed transactionId,
        address indexed customer,
        string blockchainHash
    );
    
    event RefundApproved(string indexed transactionId);
    
    event AutoRefundClaimed(string indexed transactionId);
    
    event DisputeResolved(string indexed transactionId, string resolution);

    // Modifiers
    modifier onlyValidTransaction(string memory transactionId) {
        require(
            transactions[transactionId].customer != address(0),
            "Transaction does not exist"
        );
        _;
    }

    modifier onlyCustomer(string memory transactionId) {
        require(
            msg.sender == transactions[transactionId].customer,
            "Only customer can call this"
        );
        _;
    }

    modifier onlyCompany(string memory transactionId) {
        require(
            msg.sender == transactions[transactionId].company,
            "Only company can call this"
        );
        _;
    }

    modifier notDisputed(string memory transactionId) {
        require(
            transactions[transactionId].status != Status.Disputed,
            "Transaction is disputed"
        );
        _;
    }

    /**
     * @dev Create a new escrow transaction
     * @param transactionId Unique transaction identifier
     * @param company Company wallet address
     */
    function createEscrow(
        string memory transactionId,
        address company
    ) external payable nonReentrant {
        require(
            transactions[transactionId].customer == address(0),
            "Transaction already exists"
        );
        require(company != address(0), "Invalid company address");
        require(msg.value > 0, "Amount must be greater than 0");

        transactions[transactionId] = Transaction({
            customer: msg.sender,
            company: company,
            amount: msg.value,
            deadline: block.timestamp + ESCROW_DURATION,
            status: Status.Pending,
            transactionId: transactionId,
            createdAt: block.timestamp
        });

        emit EscrowCreated(transactionId, msg.sender, company, msg.value);
    }

    /**
     * @dev Customer confirms receipt of product
     * @param transactionId Transaction identifier
     */
    function confirmReceipt(
        string memory transactionId
    ) external nonReentrant onlyCustomer(transactionId) notDisputed(transactionId) {
        Transaction storage txn = transactions[transactionId];
        
        require(txn.status == Status.Pending, "Invalid status for confirmation");
        require(block.timestamp <= txn.deadline, "Deadline passed");

        txn.status = Status.Completed;

        // Transfer funds to company
        (bool success, ) = payable(txn.company).call{value: txn.amount}("");
        require(success, "Transfer to company failed");

        emit ReceiptConfirmed(transactionId);
    }

    /**
     * @dev File a complaint for a transaction
     * @param transactionId Transaction identifier
     * @param description Complaint description
     * @param category AI-classified category
     * @param urgency AI-classified urgency
     * @param aiScore AI confidence score
     * @param aiApproved Whether AI approved the complaint
     * @param blockchainHash SHA-256 hash for blockchain proof
     */
    function fileComplaint(
        string memory transactionId,
        string memory description,
        ComplaintCategory category,
        Urgency urgency,
        uint256 aiScore,
        bool aiApproved,
        string memory blockchainHash
    ) external nonReentrant onlyCustomer(transactionId) {
        Transaction storage txn = transactions[transactionId];
        
        require(txn.status == Status.Pending, "Cannot complaint on this status");
        require(
            block.timestamp <= txn.createdAt + COMPLAINT_WINDOW,
            "Complaint window closed"
        );

        complaints[transactionId] = Complaint({
            transactionId: transactionId,
            customer: msg.sender,
            company: txn.company,
            description: description,
            category: category,
            urgency: urgency,
            aiScore: aiScore,
            aiApproved: aiApproved,
            blockchainHash: blockchainHash,
            filedAt: block.timestamp
        });

        txn.status = Status.Disputed;

        emit ComplaintFiled(transactionId, msg.sender, blockchainHash);
    }

    /**
     * @dev Company approves refund
     * @param transactionId Transaction identifier
     */
    function approveRefund(
        string memory transactionId
    ) external nonReentrant onlyCompany(transactionId) {
        Transaction storage txn = transactions[transactionId];
        
        require(txn.status == Status.Disputed, "No dispute to resolve");

        txn.status = Status.Refunded;

        // Transfer funds back to customer
        (bool success, ) = payable(txn.customer).call{value: txn.amount}("");
        require(success, "Refund to customer failed");

        // Update company trust score
        CompanyBond storage bond = companyBonds[txn.company];
        if (bond.trustScore > 0) {
            bond.trustScore = bond.trustScore > 5 ? bond.trustScore - 5 : 0;
        }

        emit RefundApproved(transactionId);
    }

    /**
     * @dev Customer claims auto refund after deadline
     * @param transactionId Transaction identifier
     */
    function claimAutoRefund(
        string memory transactionId
    ) external nonReentrant onlyCustomer(transactionId) {
        Transaction storage txn = transactions[transactionId];
        
        require(txn.status == Status.Disputed, "No dispute to resolve");
        require(block.timestamp > txn.deadline, "Deadline not passed");

        txn.status = Status.AutoRefunded;

        // Transfer funds back to customer
        (bool success, ) = payable(txn.customer).call{value: txn.amount}("");
        require(success, "Refund to customer failed");

        // Decrease company trust score
        CompanyBond storage bond = companyBonds[txn.company];
        if (bond.trustScore > 0) {
            bond.trustScore = bond.trustScore > 10 ? bond.trustScore - 10 : 0;
        }

        emit AutoRefundClaimed(transactionId);
    }

    /**
     * @dev Company offers resolution (partial refund or replacement)
     * @param transactionId Transaction identifier
     * @param resolutionAmount Amount to be released
     */
    function offerResolution(
        string memory transactionId,
        uint256 resolutionAmount
    ) external nonReentrant onlyCompany(transactionId) {
        Transaction storage txn = transactions[transactionId];
        
        require(txn.status == Status.Disputed, "No dispute to resolve");
        require(resolutionAmount <= txn.amount, "Amount exceeds escrow");

        // Transfer partial amount to customer
        (bool success, ) = payable(txn.customer).call{value: resolutionAmount}("");
        require(success, "Resolution transfer failed");

        emit DisputeResolved(transactionId, "Resolution offered");
    }

    /**
     * @dev Register a company with security bond
     * @param companyAddress Company wallet address
     */
    function registerCompany(
        address companyAddress
    ) external payable {
        require(
            companyBonds[companyAddress].bondAmount == 0,
            "Company already registered"
        );

        companyBonds[companyAddress] = CompanyBond({
            companyAddress: companyAddress,
            bondAmount: msg.value,
            isCertified: msg.value >= 1 ether,
            trustScore: msg.value >= 1 ether ? 80 : 50
        });
    }

    /**
     * @dev Get escrow status
     * @param transactionId Transaction identifier
     */
    function getEscrowStatus(
        string memory transactionId
    ) external view returns (
        address customer,
        address company,
        uint256 amount,
        uint256 deadline,
        Status status,
        uint256 createdAt
    ) {
        Transaction storage txn = transactions[transactionId];
        return (
            txn.customer,
            txn.company,
            txn.amount,
            txn.deadline,
            txn.status,
            txn.createdAt
        );
    }

    /**
     * @dev Get company bond details
     * @param companyAddress Company wallet address
     */
    function getCompanyBond(
        address companyAddress
    ) external view returns (
        uint256 bondAmount,
        bool isCertified,
        uint256 trustScore
    ) {
        CompanyBond storage bond = companyBonds[companyAddress];
        return (bond.bondAmount, bond.isCertified, bond.trustScore);
    }

    /**
     * @dev Get complaint details
     * @param transactionId Transaction identifier
     */
    function getComplaint(
        string memory transactionId
    ) external view returns (
        address customer,
        address company,
        string memory description,
        ComplaintCategory category,
        Urgency urgency,
        uint256 aiScore,
        bool aiApproved,
        string memory blockchainHash,
        uint256 filedAt
    ) {
        Complaint storage cmp = complaints[transactionId];
        return (
            cmp.customer,
            cmp.company,
            cmp.description,
            cmp.category,
            cmp.urgency,
            cmp.aiScore,
            cmp.aiApproved,
            cmp.blockchainHash,
            cmp.filedAt
        );
    }

    // Emergency withdraw for stuck funds
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // ==================== INDUSTRY-SPECIFIC FUNCTIONS ====================

    // ========== INSURANCE FUNCTIONS ==========
    
    /**
     * @dev File an insurance claim
     */
    function fileInsuranceClaim(
        string memory claimId,
        address insurer,
        uint256 claimAmount,
        string memory diagnosis,
        InsuranceUrgency urgency,
        string memory policyHash
    ) external payable {
        require(insuranceClaims[claimId].customer == address(0), "Claim exists");
        
        uint256 deadline = urgency == InsuranceUrgency.Critical 
            ? block.timestamp + 24 hours 
            : block.timestamp + 30 days;
            
        insuranceClaims[claimId] = InsuranceClaim({
            claimId: claimId,
            customer: msg.sender,
            insurer: insurer,
            claimAmount: claimAmount,
            diagnosis: diagnosis,
            urgency: urgency,
            status: InsuranceStatus.Pending,
            deadline: deadline,
            filedAt: block.timestamp,
            policyHash: policyHash
        });

        emit InsuranceClaimFiled(claimId, msg.sender, claimAmount, urgency);
        emit InsuranceUrgencyDetected(claimId, urgency, deadline);
    }

    /**
     * @dev AI reviews insurance claim and sets urgency
     */
    function aiReviewInsuranceClaim(
        string memory claimId,
        InsuranceUrgency urgency
    ) external {
        InsuranceClaim storage claim = insuranceClaims[claimId];
        require(claim.customer != address(0), "Claim not found");
        
        claim.urgency = urgency;
        claim.status = InsuranceStatus.AiReviewed;
        
        // Set deadline based on urgency
        claim.deadline = urgency == InsuranceUrgency.Critical 
            ? block.timestamp + 24 hours 
            : block.timestamp + 30 days;
            
        emit InsuranceUrgencyDetected(claimId, urgency, claim.deadline);
    }

    /**
     * @dev Insurer approves insurance claim
     */
    function approveInsuranceClaim(string memory claimId) external {
        InsuranceClaim storage claim = insuranceClaims[claimId];
        require(msg.sender == claim.insurer, "Only insurer");
        require(claim.status == InsuranceStatus.AiReviewed || claim.status == InsuranceStatus.Pending, "Invalid status");
        
        claim.status = InsuranceStatus.InsurerApproved;
        
        // Transfer claim amount to customer
        (bool success, ) = payable(claim.customer).call{value: claim.claimAmount}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Trigger penalty for insurer delay (critical claims)
     */
    function triggerInsurancePenalty(string memory claimId) external {
        InsuranceClaim storage claim = insuranceClaims[claimId];
        require(block.timestamp > claim.deadline, "Deadline not passed");
        require(claim.status != InsuranceStatus.InsurerApproved, "Already approved");
        
        claim.status = InsuranceStatus.PenaltyTriggered;
        
        // Penalty is 1% per day from insurer's bond
        CompanyBond storage bond = companyBonds[claim.insurer];
        uint256 penalty = claim.claimAmount * 1 / 100;
        
        if (bond.bondAmount >= penalty) {
            companyBonds[claim.insurer].bondAmount -= penalty;
            (bool success, ) = payable(claim.customer).call{value: penalty}("");
            require(success, "Penalty transfer failed");
        }
    }

    // ========== RENTAL FUNCTIONS ==========
    
    /**
     * @dev Create rental agreement with deposit escrow
     */
    function createRentalAgreement(
        string memory agreementId,
        address landlord,
        uint256 totalDeposit,
        string memory propertyHash
    ) external payable {
        require(rentalAgreements[agreementId].tenant == address(0), "Agreement exists");
        require(msg.value == totalDeposit / 2, "Must deposit 50% to escrow");
        
        rentalAgreements[agreementId] = RentalAgreement({
            agreementId: agreementId,
            tenant: msg.sender,
            landlord: landlord,
            totalDeposit: totalDeposit,
            escrowAmount: msg.value,
            moveInTimestamp: 0,
            moveOutTimestamp: 0,
            status: RentalStatus.Pending,
            propertyHash: propertyHash
        });

        emit RentalMoveInRecorded(agreementId, msg.sender, msg.value);
    }

    /**
     * @dev Record move-in with photos
     */
    function recordMoveIn(string memory agreementId) external {
        RentalAgreement storage agreement = rentalAgreements[agreementId];
        require(msg.sender == agreement.tenant || msg.sender == agreement.landlord, "Not authorized");
        require(agreement.status == RentalStatus.Pending, "Invalid status");
        
        agreement.moveInTimestamp = block.timestamp;
        agreement.status = RentalStatus.MoveInRecorded;
    }

    /**
     * @dev Record move-out and trigger AI assessment
     */
    function recordMoveOut(string memory agreementId) external {
        RentalAgreement storage agreement = rentalAgreements[agreementId];
        require(msg.sender == agreement.tenant || msg.sender == agreement.landlord, "Not authorized");
        require(agreement.status == RentalStatus.Active, "Not active");
        
        agreement.moveOutTimestamp = block.timestamp;
        agreement.status = RentalStatus.MoveOutRecorded;
    }

    /**
     * @dev Resolve rental dispute and release deposit
     */
    function resolveRentalDispute(
        string memory agreementId,
        uint256 refundAmount
    ) external {
        RentalAgreement storage agreement = rentalAgreements[agreementId];
        require(agreement.status == RentalStatus.AiAssessed || agreement.status == RentalStatus.Dispute, "Invalid status");
        
        // Release escrow to tenant
        if (refundAmount > 0 && agreement.escrowAmount > 0) {
            (bool success, ) = payable(agreement.tenant).call{value: refundAmount}("");
            require(success, "Refund failed");
        }
        
        agreement.status = RentalStatus.Resolved;
    }

    // ========== EDTECH FUNCTIONS ==========
    
    /**
     * @dev Enroll student in course with milestone escrow
     */
    function enrollInCourse(
        string memory enrollmentId,
        address platform,
        uint256 totalFee,
        uint256 milestoneCount,
        string memory courseHash
    ) external payable {
        require(courseEnrollments[enrollmentId].student == address(0), "Enrollment exists");
        require(msg.value == totalFee, "Must pay full fee");
        
        courseEnrollments[enrollmentId] = CourseEnrollment({
            enrollmentId: enrollmentId,
            student: msg.sender,
            platform: platform,
            totalFee: totalFee,
            releasedAmount: 0,
            milestoneCount: milestoneCount,
            status: EdTechStatus.Enrolled,
            courseHash: courseHash
        });

        emit CourseEnrolled(enrollmentId, msg.sender, totalFee);
    }

    /**
     * @dev Release milestone payment to platform
     */
    function releaseMilestone(
        string memory enrollmentId,
        uint8 milestone
    ) external {
        CourseEnrollment storage enrollment = courseEnrollments[enrollmentId];
        require(enrollment.student == msg.sender || enrollment.platform == msg.sender, "Not authorized");
        require(enrollment.status == EdTechStatus.MilestoneBased, "Invalid status");
        
        uint256 milestoneAmount = enrollment.totalFee / enrollment.milestoneCount;
        require(enrollment.releasedAmount + milestoneAmount <= enrollment.totalFee, "Exceeds total");
        
        enrollment.releasedAmount += milestoneAmount;
        
        (bool success, ) = payable(enrollment.platform).call{value: milestoneAmount}("");
        require(success, "Milestone transfer failed");
        
        emit MilestoneReleased(enrollmentId, milestone, milestoneAmount);
    }

    /**
     * @dev File complaint and freeze remaining milestones
     */
    function fileCourseComplaint(
        string memory enrollmentId,
        uint8 validityScore
    ) external {
        CourseEnrollment storage enrollment = courseEnrollments[enrollmentId];
        require(enrollment.student == msg.sender, "Only student");
        require(enrollment.status == EdTechStatus.MilestoneBased, "Invalid status");
        
        enrollment.status = EdTechStatus.ComplaintFiled;
        
        emit CourseComplaintFiled(enrollmentId, msg.sender, validityScore);
    }

    /**
     * @dev Process course refund
     */
    function processCourseRefund(
        string memory enrollmentId,
        uint256 refundAmount
    ) external {
        CourseEnrollment storage enrollment = courseEnrollments[enrollmentId];
        require(enrollment.status == EdTechStatus.ComplaintFiled, "No complaint");
        
        uint256 remaining = enrollment.totalFee - enrollment.releasedAmount;
        require(refundAmount <= remaining, "Exceeds remaining");
        
        // Refund student
        if (refundAmount > 0) {
            (bool success, ) = payable(enrollment.student).call{value: refundAmount}("");
            require(success, "Refund failed");
        }
        
        enrollment.status = EdTechStatus.RefundProcessed;
    }

    // ========== HOSPITAL FUNCTIONS ==========
    
    /**
     * @dev Create hospital package agreement
     */
    function createHospitalPackage(
        string memory admissionId,
        address hospital,
        uint256 packageAmount,
        string memory packageHash
    ) external payable {
        require(hospitalPackages[admissionId].patient == address(0), "Admission exists");
        require(msg.value >= packageAmount * 70 / 100, "Must pay 70% upfront");
        
        hospitalPackages[admissionId] = HospitalPackage({
            admissionId: admissionId,
            patient: msg.sender,
            hospital: hospital,
            packageAmount: packageAmount,
            paidToHospital: msg.value,
            heldInEscrow: packageAmount - msg.value,
            status: HospitalStatus.PackageAgreed,
            packageHash: packageHash
        });

        emit HospitalPackageAgreed(admissionId, msg.sender, packageAmount);
    }

    /**
     * @dev Record patient consent for extra charges
     */
    function recordHospitalConsent(
        string memory admissionId,
        string memory item,
        uint256 amount
    ) external {
        HospitalPackage storage pkg = hospitalPackages[admissionId];
        require(msg.sender == pkg.patient, "Only patient");
        require(pkg.status == HospitalStatus.TreatmentActive || pkg.status == HospitalStatus.PackageAgreed, "Invalid status");
        
        pkg.status = HospitalStatus.ConsentRequired;
        
        emit HospitalConsentGiven(admissionId, item, amount);
    }

    /**
     * @dev Dispute hospital bill
     */
    function disputeHospitalBill(
        string memory admissionId,
        uint256 disputedAmount,
        uint256 authorizedAmount
    ) external {
        HospitalPackage storage pkg = hospitalPackages[admissionId];
        require(msg.sender == pkg.patient, "Only patient");
        require(pkg.status == HospitalStatus.Discharge, "Not at discharge");
        
        pkg.status = HospitalStatus.BillDisputed;
        
        // Hold disputed amount in escrow
        uint256 held = pkg.heldInEscrow;
        if (disputedAmount < held) {
            uint256 release = held - disputedAmount;
            (bool success, ) = payable(pkg.hospital).call{value: release}("");
            require(success, "Release failed");
        }
        
        emit HospitalBillDisputed(admissionId, disputedAmount, authorizedAmount);
    }

    /**
     * @dev Resolve hospital bill dispute
     */
    function resolveHospitalBill(
        string memory admissionId,
        uint256 finalAmount
    ) external {
        HospitalPackage storage pkg = hospitalPackages[admissionId];
        require(pkg.status == HospitalStatus.BillDisputed, "No dispute");
        
        // Release remaining escrow
        if (pkg.heldInEscrow > 0) {
            (bool success, ) = payable(pkg.hospital).call{value: pkg.heldInEscrow}("");
            require(success, "Payment failed");
        }
        
        pkg.status = HospitalStatus.Resolved;
    }

    // Receive ETH
    receive() external payable {}
}