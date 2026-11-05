using Xunit;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Artifax.Controllers;
using Artifax.Data;
using Artifax.Models;
using Artifax.DTOs;
using System;
using System.Threading.Tasks; 
using Moq;
using Microsoft.AspNetCore.Http;
using System.Text;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore.InMemory.Query.Internal;
using Google.Authenticator;

namespace Backend.Tests
{
    public class UserControllerTests
    {
        #region classes
            class FakeSession : ISession {
                private readonly Dictionary<string, byte[]> _sessionStorage = new();
                public bool IsAvailable => true;
                public string Id => Guid.NewGuid().ToString();
                public IEnumerable<string> Keys => _sessionStorage.Keys;
                public void Set(string key, byte[] value) => _sessionStorage[key] = value;
                public bool TryGetValue(string key, out byte[] value) => _sessionStorage.TryGetValue(key, out value);
                public void Remove(string key) => _sessionStorage.Remove(key);
                public void Clear() => _sessionStorage.Clear();
                public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
                public Task LoadAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
            }
        #endregion

        Employee[] testEmployees = [
            new Employee {EmployeeEmail="employee1@artifax.com",EmployeeName="Emp1",EmployeePasswordHash="123", EmployeeLevel="Employee"}, 
            new Employee {EmployeeEmail="employee2@artifax.com",EmployeeName="Emp2",EmployeePasswordHash="123", EmployeeLevel="Employee"}, 
            new Employee {EmployeeEmail="employee3@artifax.com",EmployeeName="Emp3",EmployeePasswordHash="123", EmployeeLevel="Employee"}, 
            new Employee {EmployeeEmail="admin1@artifax.com",EmployeeName="Ad1",EmployeePasswordHash="123", EmployeeLevel="Admin"}, 
            new Employee {EmployeeEmail="admin2@artifax.com",EmployeeName="Ad2",EmployeePasswordHash="123", EmployeeLevel="Admin"}, 
            new Employee {EmployeeEmail="admin3@artifax.com",EmployeeName="Ad3",EmployeePasswordHash="123", EmployeeLevel="Admin"}, 
        ];

        Branch[] testBranches = [
            new Branch {BranchID=1,BranchName="Johannesburg" },
            new Branch {BranchID=2,BranchName="Centurion" },
            new Branch {BranchID=3,BranchName="Durban" },
            new Branch {BranchID=4,BranchName="Head Office" },
        ];

        // Helper method to build an isolated, clean in-memory database context for every test
        private DbContextOptions<ArtifaxContext> GetDbContextOptions()
        {
            return new DbContextOptionsBuilder<ArtifaxContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
        }

        async Task<UserController> GetEmptyDummyController ()
        {
            var _options = GetDbContextOptions();
            var _context = new ArtifaxContext(_options);

            var _controller = new UserController(_context);

            return _controller;
        }

        // Context behind the most recent GetPopulatedDummyController, used to read 2FA secrets
        ArtifaxContext _populatedContext;

        async Task<UserController> GetPopulatedDummyController ()
        {
            var _options = GetDbContextOptions();
            var _context = new ArtifaxContext(_options);
            _populatedContext = _context;
            
            foreach (var testEmployee in testEmployees)
            {
                testEmployee.EmployeePasswordHash = BCrypt.Net.BCrypt.HashPassword(testEmployee.EmployeePasswordHash);
                _context.Employees.Add(testEmployee);
            }

            foreach (var testBranch in testBranches)
            {
                _context.Branches.Add(testBranch);
            }

            await _context.SaveChangesAsync();
            var _controller = new UserController(_context);

            return _controller;
        }  

        Mock<HttpContext> GetMockSession ()
        {
            var _fakeSession = new FakeSession();

            var _httpContextMock = new Mock<HttpContext>();
            _httpContextMock.Setup(c => c.Session).Returns(_fakeSession);
            return _httpContextMock;
        }

        // Logs in through both steps: password, then a TOTP code generated from the stored secret
        // exactly as an authenticator app would.
        async Task<ActionResult<EmployeeReadDto>> LoginWith2FaAsync(UserController controller, string email, string password)
        {
            await controller.LoginEmployee(new (){Email=email, Password=password});

            var _secret = (await _populatedContext.Employees.FirstAsync(e => e.EmployeeEmail == email)).TwoFactorSecret;
            var _code = new TwoFactorAuthenticator().GetCurrentPIN(_secret);
            return await controller.Verify2Fa(new Dictionary<string, string> { ["code"] = _code });
        }

        [Fact]
        public async Task GetEmployee_WhenEmployeeExists()
        {
            //ARRANGE
            var _controller = await GetPopulatedDummyController();

            //ACT
            var _result = await _controller.GetEmployeeByEmail("employee1@artifax.com");

            //ASSERT
            var _actionResult = Assert.IsType<ActionResult<EmployeeReadDto>>(_result);
            var _returnedDto = Assert.IsType<EmployeeReadDto>(_actionResult.Value);
            Assert.Equal("Emp1", _returnedDto.EmployeeName);
        }

        [Fact]
        public async Task GetAdmin_WhenNoAdmin()
        {
            //ARRANGE
            var _controller = await GetPopulatedDummyController();

            //ACT
            var _result = await _controller.GetEmployeeByEmail("admin5@artifax.com");

            //ASSERT
            var _actionResult = Assert.IsType<ActionResult<EmployeeReadDto>>(_result);
            Assert.IsNotType<EmployeeReadDto>(_actionResult.Value);
        }

        [Fact]
        public async Task LoginEmployee_WhenEmployeeExist()
        {
            // Given
            var _controller = await GetPopulatedDummyController();
            var httpContextMock = GetMockSession();
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = httpContextMock.Object
            };
        
            // When
            var _dto = await _controller.LoginEmployee(new (){Email="employee1@artifax.com", Password="123"});
        
            // Then: the password step succeeds but asks for a 2FA code, without logging the user in yet
            var _actionResult = Assert.IsType<ActionResult<EmployeeReadDto>> (_dto);
            Assert.IsType<OkObjectResult>(_actionResult.Result);
            Assert.Equal("employee1@artifax.com", _httpContextMockSessionValue(httpContextMock, "Pending2FAEmail"));
            Assert.Null(_httpContextMockSessionValue(httpContextMock, "UserLevel"));
        }

        [Fact]
        public async Task LoginEmployee_WithValid2FaCode_ReturnsEmployee()
        {
            // Given
            var _controller = await GetPopulatedDummyController();
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = GetMockSession().Object
            };
        
            // When
            var _dto = await LoginWith2FaAsync(_controller, "employee1@artifax.com", "123");
        
            // Then
            var _returnedOk = Assert.IsType<OkObjectResult>(_dto.Result);
            var _returnedDto = Assert.IsType<EmployeeReadDto>(_returnedOk.Value);
            Assert.Equal("Emp1", _returnedDto.EmployeeName);
        }

        [Fact]
        public async Task LoginEmployee_WithWrong2FaCode_IsRejected()
        {
            // Given
            var _controller = await GetPopulatedDummyController();
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = GetMockSession().Object
            };
            await _controller.LoginEmployee(new (){Email="employee1@artifax.com", Password="123"});
        
            // When
            var _dto = await _controller.Verify2Fa(new Dictionary<string, string> { ["code"] = "000000" });
        
            // Then
            Assert.IsType<UnauthorizedObjectResult>(_dto.Result);
        }

        static string _httpContextMockSessionValue(Mock<HttpContext> httpContextMock, string key)
        {
            return httpContextMock.Object.Session.TryGetValue(key, out var _bytes) ? Encoding.UTF8.GetString(_bytes) : null;
        }

        [Fact]
        public async Task LoginEmployee_WhenEmployeeDoesNotExist()
        {
            // Given
            var _controller = await GetPopulatedDummyController();
            var httpContextMock = GetMockSession();
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = httpContextMock.Object
            };
        
            // When
            var _dto = await _controller.LoginEmployee(new (){Email="test@artifax.com", Password="testPass"});
        
            // Then
            var _actionResult = Assert.IsType<ActionResult<EmployeeReadDto>> (_dto);
            Assert.IsType<UnauthorizedObjectResult>(_actionResult.Result);
        }

        [Fact]
        public async Task ChangeExistingEmployeeBranch()
        {
            // Given
            var _controller = await GetPopulatedDummyController();
            var _httpContextMock = GetMockSession();
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = _httpContextMock.Object
            };
            await LoginWith2FaAsync(_controller, "admin1@artifax.com", "123");
        
            // When
            var _response = await _controller.ChangeEmployeeBranch("employee1@artifax.com", 2);
        
            // Then
            var _baseResult = Assert.IsType<ActionResult<EmployeeReadDto>>(_response);
            var _returnedOk = Assert.IsType<OkObjectResult>(_baseResult.Result);
            var _result = Assert.IsType<EmployeeReadDto>(_returnedOk.Value);

            Assert.Equal(2, _result.BranchId);
            Assert.Equal("employee1@artifax.com", _result.EmployeeEmail);
            Assert.Equal("Emp1", _result.EmployeeName);
        }

        [Fact]
        public async Task DeleteNonExistingEmployee()
        {
            // Given
            var _controller = await GetPopulatedDummyController();
            var _httpContextMock = GetMockSession();
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = _httpContextMock.Object
            };
            await LoginWith2FaAsync(_controller, "admin1@artifax.com", "123");
        
            // When
            var _response = await _controller.DeleteEmployee(100);
        
            // Then
            Assert.IsType<NotFoundObjectResult>(_response);
        }

        [Fact]
        public async Task Fetch_CorrectSessionDetails_WhenLoggingIn()
        {
            // Given
            var _controller = await GetPopulatedDummyController();
            var _httpContextMock = GetMockSession();
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = _httpContextMock.Object
            };
            await LoginWith2FaAsync(_controller, "admin1@artifax.com", "123");
        
            // When
            var _response = _controller.GetCurrentUser();
        
            // Then
            var _returnedOk = Assert.IsType<OkObjectResult>(_response);
            var _result = Assert.IsType<CurrentUserDto>(_returnedOk.Value);

            Assert.Equal( "Admin", _result.UserLevel);
            Assert.Equal("admin1@artifax.com", _result.UserEmail);
            Assert.Equal("Ad1", _result.Username);
        }

        #region Editing users

        async Task<UserController> SignedInAdminController(string email = "admin1@artifax.com")
        {
            var _controller = await GetPopulatedDummyController();
            _controller.ControllerContext = new ControllerContext { HttpContext = GetMockSession().Object };
            await LoginWith2FaAsync(_controller, email, "123");
            return _controller;
        }

        static EmployeeWriteDto Edit(string email, string name, int branchId, string level) =>
            new() { EmployeeEmail = email, EmployeeName = name, BranchID = branchId, EmployeeLevel = level };

        Task<Employee> Stored(string email) =>
            _populatedContext.Employees.AsNoTracking().FirstAsync(e => e.EmployeeEmail == email);

        [Fact]
        public async Task Edit_SavesBranchAndRoleTogetherWithOtherDetails()
        {
            var _controller = await SignedInAdminController();

            var _response = await _controller.ChangeEmployeeDetails("employee1@artifax.com",
                Edit("employee1@artifax.com", "Emp1 Renamed", 3, "Admin"));

            Assert.IsType<OkObjectResult>(_response.Result);
            var _saved = await Stored("employee1@artifax.com");
            Assert.Equal("Emp1 Renamed", _saved.EmployeeName);
            Assert.Equal(3, _saved.BranchId);
            Assert.Equal("Admin", _saved.EmployeeLevel);
        }

        [Fact]
        public async Task Edit_KeepsBranchAndRole_WhenAnOlderClientOmitsThem()
        {
            var _controller = await SignedInAdminController();
            await _controller.ChangeEmployeeBranch("employee1@artifax.com", 2);

            var _response = await _controller.ChangeEmployeeDetails("employee1@artifax.com",
                new EmployeeWriteDto { EmployeeEmail = "employee1@artifax.com", EmployeeName = "Emp1" });

            Assert.IsType<OkObjectResult>(_response.Result);
            var _saved = await Stored("employee1@artifax.com");
            Assert.Equal(2, _saved.BranchId);
            Assert.Equal("Employee", _saved.EmployeeLevel);
        }

        [Fact]
        public async Task Edit_RejectsUnknownBranchAndRole()
        {
            var _controller = await SignedInAdminController();

            var _badBranch = await _controller.ChangeEmployeeDetails("employee1@artifax.com", Edit("employee1@artifax.com", "Emp1", 99, "Employee"));
            var _badRole = await _controller.ChangeEmployeeDetails("employee1@artifax.com", Edit("employee1@artifax.com", "Emp1", 1, "Owner"));
            var _demoRole = await _controller.ChangeEmployeeDetails("employee1@artifax.com", Edit("employee1@artifax.com", "Emp1", 1, "Demo"));

            Assert.IsType<BadRequestObjectResult>(_badBranch.Result);
            Assert.IsType<BadRequestObjectResult>(_badRole.Result);
            Assert.IsType<BadRequestObjectResult>(_demoRole.Result);
            Assert.Equal("Employee", (await Stored("employee1@artifax.com")).EmployeeLevel);
        }

        [Fact]
        public async Task Edit_RejectsAnEmailAnotherUserHas()
        {
            var _controller = await SignedInAdminController();

            var _response = await _controller.ChangeEmployeeDetails("employee1@artifax.com",
                Edit("employee2@artifax.com", "Emp1", 1, "Employee"));

            Assert.IsType<ConflictObjectResult>(_response.Result);
            Assert.Equal("Emp1", (await Stored("employee1@artifax.com")).EmployeeName);
        }

        [Fact]
        public async Task Edit_CanDemoteAnAdmin_WhileAnotherAdminRemains()
        {
            var _controller = await SignedInAdminController();

            var _response = await _controller.ChangeEmployeeDetails("admin2@artifax.com", Edit("admin2@artifax.com", "Ad2", 1, "Employee"));

            Assert.IsType<OkObjectResult>(_response.Result);
            Assert.Equal("Employee", (await Stored("admin2@artifax.com")).EmployeeLevel);
        }

        [Fact]
        public async Task LastAdmin_CannotBeDemotedOrRemoved()
        {
            var _controller = await SignedInAdminController();
            foreach (var other in _populatedContext.Employees.Where(e => e.EmployeeEmail == "admin2@artifax.com" || e.EmployeeEmail == "admin3@artifax.com"))
                other.IsArchived = true;
            await _populatedContext.SaveChangesAsync();
            int _adminId = (await Stored("admin1@artifax.com")).EmployeeId;

            var _demote = await _controller.ChangeEmployeeDetails("admin1@artifax.com", Edit("admin1@artifax.com", "Ad1", 1, "Employee"));
            var _remove = await _controller.DeleteEmployee(_adminId);

            Assert.IsType<ConflictObjectResult>(_demote.Result);
            Assert.IsType<ConflictObjectResult>(_remove);
            var _saved = await Stored("admin1@artifax.com");
            Assert.Equal("Admin", _saved.EmployeeLevel);
            Assert.False(_saved.IsArchived);
        }

        [Fact]
        public async Task EditingYourOwnAccount_UpdatesYourSession()
        {
            var _controller = await SignedInAdminController();

            await _controller.ChangeEmployeeDetails("admin1@artifax.com", Edit("admin1.new@artifax.com", "Ad1 New", 2, "Admin"));

            var _current = Assert.IsType<CurrentUserDto>(Assert.IsType<OkObjectResult>(_controller.GetCurrentUser()).Value);
            Assert.Equal("admin1.new@artifax.com", _current.UserEmail);
            Assert.Equal("Ad1 New", _current.Username);
        }

        [Fact]
        public async Task Create_RejectsUnknownRoleAndBranch()
        {
            var _controller = await SignedInAdminController();

            var _badRole = await _controller.CreateEmployee(new EmployeeWriteDto { EmployeeEmail = "new1@artifax.com", EmployeeName = "New", EmployeePassword = "secret1", BranchID = 1, EmployeeLevel = "Demo" });
            var _badBranch = await _controller.CreateEmployee(new EmployeeWriteDto { EmployeeEmail = "new2@artifax.com", EmployeeName = "New", EmployeePassword = "secret1", BranchID = 99, EmployeeLevel = "Employee" });

            Assert.IsType<BadRequestObjectResult>(_badRole.Result);
            Assert.IsType<BadRequestObjectResult>(_badBranch.Result);
            Assert.False(await _populatedContext.Employees.AnyAsync(e => e.EmployeeEmail.StartsWith("new")));
        }

        #endregion
    }
}