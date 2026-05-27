// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Google-Standard Security Imports from OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CompoundOS Treasury (V2 Enterprise)
 * @author Lithos (Emmaprof)
 * @notice Highly secure, privacy-preserving decentralized treasury.
 * @dev Implements Pausable circuit breakers, 2-Step Admin transfers, and hashed telemetry.
 */
contract CompoundOSTreasury is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public relayerKey;

    // PRIVACY UPGRADE: We only store cryptographic hashes, never raw database strings.
    mapping(bytes32 => bool) public processedInvoices;

    // Telemetry Events
    event InvoicePaidManual(address indexed resident, bytes32 indexed invoiceHash, uint256 amount);
    event InvoicePaidVault(address indexed resident, bytes32 indexed invoiceHash, uint256 amount);
    event WithdrawnToAdmin(address indexed admin, uint256 amount);
    event RoutedToExternal(address indexed admin, address destination, uint256 amount);
    event RelayerUpdated(address oldRelayer, address newRelayer);

    // Gas-Optimized Custom Errors
    error UnauthorizedRelayer();
    error InvoiceAlreadyProcessed();
    error InvalidAmount();
    error InvalidDestination();
    error ZeroBalance();

    constructor(address _usdcAddress, address _relayerKey) Ownable(msg.sender) {
        if (_usdcAddress == address(0) || _relayerKey == address(0)) revert InvalidDestination();
        usdc = IERC20(_usdcAddress);
        relayerKey = _relayerKey;
    }

    // --- SECURITY MODIFIERS ---

    modifier onlyRelayer() {
        if (msg.sender != relayerKey) revert UnauthorizedRelayer();
        _;
    }

    // --- CORE ROUTING ENGINE ---

    /**
     * @notice Option 1: Resident manually pays via dApp.
     * @param invoiceHash The keccak256 hash of the Supabase invoice ID (Privacy Preserved).
     * @param amount The exact USDC amount to deduct.
     */
    function payInvoice(bytes32 invoiceHash, uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (processedInvoices[invoiceHash]) revert InvoiceAlreadyProcessed();

        processedInvoices[invoiceHash] = true;
        
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit InvoicePaidManual(msg.sender, invoiceHash, amount);
    }

    /**
     * @notice Option 2: Autonomous Vault Deduction triggered by the backend.
     */
    function executeVaultPayment(address resident, bytes32 invoiceHash, uint256 amount) external onlyRelayer whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (processedInvoices[invoiceHash]) revert InvoiceAlreadyProcessed();

        processedInvoices[invoiceHash] = true;

        usdc.safeTransferFrom(resident, address(this), amount);
        emit InvoicePaidVault(resident, invoiceHash, amount);
    }

    // --- ADMIN SETTLEMENT GATEWAY ---

    /**
     * @notice Extracts pooled USDC directly to the connected Admin's non-custodial wallet (e.g. Rabby).
     * @param amount The total USDC to extract.
     */
    function withdrawToAdmin(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        usdc.safeTransfer(msg.sender, amount);
        emit WithdrawnToAdmin(msg.sender, amount);
    }

    /**
     * @notice Routes pooled USDC to an external address (e.g. Binance/Bybit deposit address).
     */
    function routeToExternal(address destination, uint256 amount) external onlyOwner nonReentrant {
        if (destination == address(0)) revert InvalidDestination();
        if (amount == 0) revert InvalidAmount();
        usdc.safeTransfer(destination, amount);
        emit RoutedToExternal(msg.sender, destination, amount);
    }

    // --- EMERGENCY CONTROLS (CIRCUIT BREAKERS) ---

    function pauseProtocol() external onlyOwner {
        _pause();
    }

    function unpauseProtocol() external onlyOwner {
        _unpause();
    }

    function updateRelayerKey(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert InvalidDestination();
        address oldRelayer = relayerKey;
        relayerKey = newRelayer;
        emit RelayerUpdated(oldRelayer, newRelayer);
    }
}