using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Artifax.DTOs;
using Artifax.Models;
using Artifax.Data;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using System;
using Google.Authenticator;
using System.Web;

namespace Artifax.Controllers
{
    [ApiController]
    [Route("api/[Controller]")]
    public class UserController : ControllerBase
    {
        internal enum EmployeeLevels
        {
            Employee,
            Admin,
            Demo
        }

        readonly ArtifaxContext context;

        public UserController(ArtifaxContext incoming)
        {
            context = incoming;
        }

        bool isAdmin => HttpContext.Session.GetString("UserLevel") == EmployeeLevels.Admin.ToString();

        // Non-admins (including the public demo account) only see their own email address
        List<EmployeeReadDto> WithoutOtherEmails(List<EmployeeReadDto> employees)
        {
            if (isAdmin) return employees;
            var ownEmail = HttpContext.Session.GetString("UserEmail");
            foreach (var employee in employees.Where(e => e.EmployeeEmail != ownEmail))
                employee.EmployeeEmail = null;
            return employees;
        }

        #region GetRoutes
        //Get All Employees
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmployeeReadDto>>> GetAllUsers()
        {
            return WithoutOtherEmails(await context.Employees.Where(employee => !employee.IsArchived).Select(employee => EmployeeReadDto.ToDto(employee)).ToListAsync());
        }

        [HttpGet("employees")]
        public async Task<ActionResult<IEnumerable<EmployeeReadDto>>> GetAllEmployees()
        {
            return WithoutOtherEmails(await context.Employees.Where(employee => !employee.IsArchived && employee.EmployeeLevel == EmployeeLevels.Employee.ToString()).Select(employee => EmployeeReadDto.ToDto(employee)).ToListAsync());
        }

        [HttpGet("admins")]
        public async Task<ActionResult<IEnumerable<EmployeeReadDto>>> GetAllAdmins()
        {
            return WithoutOtherEmails(await context.Employees.Where(employee => !employee.IsArchived && employee.EmployeeLevel == EmployeeLevels.Admin.ToString()).Select(employee => EmployeeReadDto.ToDto(employee)).ToListAsync());
        }

        //Get All Employee by Id
        [HttpGet("employee/{email}")]
        public async Task<ActionResult<EmployeeReadDto>> GetEmployeeByEmail(string email)
        {
            var _result = await context.Employees.FirstOrDefaultAsync(employee => employee.EmployeeEmail == email);
            if (_result == null) return NotFound();
            return EmployeeReadDto.ToDto(_result);
        }

        [AllowAnonymous]
        [HttpGet("me")]
        public IActionResult GetCurrentUser()
        {
            // Check if a session exists
            var _userLevel = HttpContext.Session.GetString("UserLevel");

            if (string.IsNullOrEmpty(_userLevel))
            {
                // If no session exists, the user is logged out. 
                // Returning 401 Unauthorized tells the frontend to redirect to the login screen.
                return Unauthorized("No active session.");
            }

            // Return an anonymous object (or create a new CurrentUserDto) with the display details
            return Ok(new CurrentUserDto
            {
                UserLevel = _userLevel,
                UserEmail = HttpContext.Session.GetString("UserEmail"),
                Username = HttpContext.Session.GetString("Username")
            });
        }

        [AllowAnonymous]
        [HttpGet("2fa-setup-uri")]
        public async Task<IActionResult> Get2FaSetupUri()
        {
            var pendingEmail = HttpContext.Session.GetString("Pending2FAEmail");
            if (string.IsNullOrEmpty(pendingEmail)) return Unauthorized("No login session pending.");

            var employee = await context.Employees.FirstAsync(e => e.EmployeeEmail == pendingEmail);

            // Otherwise anyone who learned the password could enrol their own authenticator, defeating 2FA
            if (employee.TwoFactorConfirmed && employee.EmployeeLevel != EmployeeLevels.Demo.ToString())
                return StatusCode(StatusCodes.Status403Forbidden, "Two-factor authentication is already set up for this account. Use your authenticator app.");

            // Instantiate the Google Authenticator engine
            var tfa = new TwoFactorAuthenticator();

            // Generate the setup info using the raw secret we saved in the database
            var setupInfo = tfa.GenerateSetupCode("ArtifaxApp", employee.EmployeeEmail, employee.TwoFactorSecret, false, 3);

            // setupInfo.ManualEntryKey is the Base32 converted string that Authenticator apps require
            string issuer = "ArtifaxApp";
            string qrCodeUri = $"otpauth://totp/{HttpUtility.UrlEncode(issuer)}:{HttpUtility.UrlEncode(employee.EmployeeEmail)}?secret={setupInfo.ManualEntryKey}&issuer={HttpUtility.UrlEncode(issuer)}&digits=6&period=30";
            return Ok(new { qrCodeUri, rawSecret = setupInfo.ManualEntryKey });
        }
        #endregion

        #region PostRoutes

        // summary
        // Registers a new employee in the system and hashes their password.

        [HttpPost("employee")]
        public async Task<ActionResult<EmployeeReadDto>> CreateEmployee(EmployeeWriteDto incoming)
        {
            //Authentication Test
            if (!isAdmin)
            {
                return Unauthorized("Creation attempted by non-admin!");
            }

            //Check whether employee with incoming details already exists to prevent duplicate emails for login
            bool _employeeFound = await context.Employees.FirstOrDefaultAsync(_employee => _employee.EmployeeEmail == incoming.EmployeeEmail) != null;
            if (_employeeFound) return Unauthorized("Email Already Exists");

            //Creates new employee from incoming details
            Employee _employee = new()
            {
                BranchId = incoming.BranchID,
                EmployeeEmail = incoming.EmployeeEmail,
                EmployeeName = incoming.EmployeeName,
                EmployeePasswordHash = BCrypt.Net.BCrypt.HashPassword(incoming.EmployeePassword),
                EmployeeLevel = incoming.EmployeeLevel
            };

            //Save new employee to database
            context.Employees.Add(_employee);
            await context.SaveChangesAsync();

            //Convert new employee to Read DTO using static function in EmployeeReadDto class
            EmployeeReadDto _dto = EmployeeReadDto.ToDto(_employee);

            return CreatedAtAction(nameof(GetEmployeeByEmail), new { email = _employee.EmployeeEmail }, _dto);
        }

        [AllowAnonymous]
        [HttpPost("employees/login")]
        public async Task<ActionResult<EmployeeReadDto>> LoginEmployee(LoginDto incoming)
        {
            //Find employee by email
            // Archived employees can no longer sign in
            var _employee = await context.Employees.FirstOrDefaultAsync(employee => employee.EmployeeEmail == incoming.Email && !employee.IsArchived);
            if (_employee == null) return Unauthorized("Employee Not Found");

            //Verify employee password
            if (!BCrypt.Net.BCrypt.Verify(incoming.Password, _employee.EmployeePasswordHash))
            {
                return Unauthorized("Incorrect Password");
            }


            //Changes i made quickly
            if (string.IsNullOrEmpty(_employee.TwoFactorSecret))
            {
                //Generate random 32 character string for 2fa secret
                _employee.TwoFactorSecret = Guid.NewGuid().ToString().Replace("-", "");
                await context.SaveChangesAsync();
            }

            //Set the pending session state
            HttpContext.Session.SetString("Pending2FAEmail", _employee.EmployeeEmail);

            return Ok(new { requires2FA = true, email = _employee.EmployeeEmail });
        }

        [AllowAnonymous]
        [HttpPost("logout")]
        public IActionResult LogOutUser()
        {
            HttpContext.Session.Clear();

            Response.Cookies.Delete(".AspNetCore.Session");

            return NoContent();
        }

        [AllowAnonymous]
        [HttpPost("employees/verify-2fa")]
        public async Task<ActionResult<EmployeeReadDto>> Verify2Fa([FromBody] Dictionary<string, string> body)
        {
            if (!body.TryGetValue("code", out var code)) return BadRequest("Code is required");

            var pendingEmail = HttpContext.Session.GetString("Pending2FAEmail");
            if (string.IsNullOrEmpty(pendingEmail)) return Unauthorized("Session expired.");

            var _employee = await context.Employees.FirstOrDefaultAsync(e => e.EmployeeEmail == pendingEmail && !e.IsArchived);
            if (_employee == null) return Unauthorized();

            // Verify the code
            var tfa = new TwoFactorAuthenticator();
            bool isValid = tfa.ValidateTwoFactorPIN(_employee.TwoFactorSecret, code);

            if (!isValid)
            {
                return Unauthorized("Invalid 2FA Verification Code");
            }

            // The first successful code confirms the authenticator; the setup QR is not shown again
            if (!_employee.TwoFactorConfirmed && _employee.EmployeeLevel != EmployeeLevels.Demo.ToString())
            {
                _employee.TwoFactorConfirmed = true;
                await context.SaveChangesAsync();
            }

            HttpContext.Session.Remove("Pending2FAEmail");
            HttpContext.Session.SetString("UserLevel", _employee.EmployeeLevel);
            HttpContext.Session.SetString("UserEmail", _employee.EmployeeEmail);
            HttpContext.Session.SetString("Username", _employee.EmployeeName);

            return Ok(EmployeeReadDto.ToDto(_employee));
        }

        #endregion

        #region UpdateRoutes

        // summary
        // Updates the assigned branch for an existing employee.

        [HttpPatch("employee/branch")]
        public async Task<ActionResult<EmployeeReadDto>> ChangeEmployeeBranch(string EmployeeEmail, int BranchId)
        {
            //Authentication Check
            if (!isAdmin)
            {
                return Unauthorized("Update attempted by non-admin!");
            }

            //Check for existing employee
            var _employee = await context.Employees.FirstOrDefaultAsync(employee => employee.EmployeeEmail == EmployeeEmail);

            if (_employee == null) return NotFound($"Employee with Email: [{EmployeeEmail}] could not be found");

            //Check for existing branch
            bool _branchExists = await context.Branches.FindAsync(BranchId) != null;

            if (!_branchExists) return NotFound($"Branch with ID: [{BranchId.ToString()}] could not be found");

            //Update information
            _employee.BranchId = BranchId;
            await context.SaveChangesAsync();
            return Ok(EmployeeReadDto.ToDto(_employee));
        }


        // summary
        // Updates the profile information of an existing employee.

        [HttpPatch("employee")]
        public async Task<ActionResult<EmployeeReadDto>> ChangeEmployeeDetails(string EmployeeEmail, EmployeeWriteDto incoming)
        {
            //Check for existing employee
            var _employee = await context.Employees.FirstOrDefaultAsync(employee => employee.EmployeeEmail == EmployeeEmail);

            if (_employee == null) return NotFound($"Employee with email: [{EmployeeEmail}] could not be found");

            if (!isAdmin)
            {
                return Unauthorized("Update attempted by user with incorrect credentials!");
            }

            //Update details
            _employee.EmployeeEmail = incoming.EmployeeEmail;
            _employee.EmployeeName = incoming.EmployeeName;
            // Only update password hash when a new password is provided
            if (!string.IsNullOrWhiteSpace(incoming.EmployeePassword))
            {
                _employee.EmployeePasswordHash = BCrypt.Net.BCrypt.HashPassword(incoming.EmployeePassword);
            }

            //Save changes
            await context.SaveChangesAsync();
            return Ok(EmployeeReadDto.ToDto(_employee));
        }

        #endregion

        #region DeleteRoutes
        // Permanently removes an employee from the system.

        // Admin only: clears a user's two-factor setup (e.g. a lost phone). Their next sign-in generates a new
        // secret and shows the setup QR code again.
        [HttpPatch("employee/reset-2fa")]
        public async Task<IActionResult> ResetTwoFactor(int id)
        {
            if (!isAdmin)
            {
                return Unauthorized("2FA reset attempted by non-admin!");
            }

            var _employee = await context.Employees.FindAsync(id);
            if (_employee == null) return NotFound($"Employee with ID: {id} could not be found");

            _employee.TwoFactorSecret = null;
            _employee.TwoFactorConfirmed = false;
            await context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("employee")]
        public async Task<IActionResult> DeleteEmployee(int id)
        {
            //Authentication Check
            if (!isAdmin)
            {
                return Unauthorized("Delete attempted by non-admin!");
            }
            //Check for existing admin
            var _employee = await context.Employees.FindAsync(id);
            if (_employee == null) return NotFound($"Employee with ID: {id.ToString()} could not be found");
            // Archive rather than delete: their orders and order history stay intact, and they can no longer sign in
            _employee.IsArchived = true;
            //Save changes
            await context.SaveChangesAsync();
            return NoContent();
        }
        #endregion
    }
}