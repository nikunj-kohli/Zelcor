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

    // Complaint categories
    enum ComplaintCategory {
        None,
        WrongProduct,
        Damaged,
        Missing,
        NotAsDescribed,
        Counterfeit,
        Other
    }

    // Complaint urgency levels
    enum Urgency {
        Low,
        Medium,
        High
    }

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

    // Receive ETH
    receive() external payable {}
}