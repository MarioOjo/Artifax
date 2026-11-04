using System.Diagnostics;
using Artifax.Data;
using Artifax.DTOs;
using Artifax.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Artifax.Controllers
{
    [ApiController]
    [Route("api/[Controller]")]
    public class BranchController : ControllerBase
    {
        const string adminLevel = "Admin";
        readonly ArtifaxContext context;

        public BranchController (ArtifaxContext incoming)
        {
            context = incoming;
        }

        #region GET
            [HttpGet]
            public async Task<ActionResult<IEnumerable<BranchDto>>> GetAll ()
            {
                return await context.Branches.Where(_branch => !_branch.IsArchived).Select(_branch => BranchDto.ToDto(_branch)).ToListAsync();
            }

            [HttpGet("{id}")]
            public async Task<ActionResult<IEnumerable<BranchDto>>> GetBranchById (int id)
            {
                var _result = await context.Branches.FindAsync(id);
                if (_result == null) return NotFound();
                return Ok(BranchDto.ToDto(_result));
            }
        #endregion

        #region CREATE
            [HttpPost]
            public async Task<ActionResult<BranchDto>> CreateBranch (BranchDto incoming)
            {
                //Authentication Test
                if (HttpContext.Session.GetString("UserLevel") != adminLevel)
                {
                    return Unauthorized("Creation attempted by non-admin!");
                }

                if (context.Branches.Count() > 0) {
                    incoming.BranchID = context.Branches.Max(b => b.BranchID + 1);
                } else
                {
                    incoming.BranchID = 0;
                }

                Console.WriteLine($"BranchID [{incoming.BranchID}] BranchName [{incoming.BranchName}]");
                context.Branches.Add(incoming.ToBranch());
                await context.SaveChangesAsync();
                return CreatedAtAction("GetBranchById", new { id = incoming.BranchID}, incoming);;
            }
        #endregion

        #region UPDATE
            [HttpPatch]
            public async Task<ActionResult<Branch>> UpdateBranchName (int id, string incoming)
            {
                //Authentication Test
                if (HttpContext.Session.GetString("UserLevel") != adminLevel)
                {
                    return Unauthorized("Update attempted by non-admin!");
                }

                var _result = await context.Branches.FindAsync(id);
                if (_result == null) return NotFound();

                _result.BranchName = incoming;
                await context.SaveChangesAsync();

                return Ok(BranchDto.ToDto(_result));
            }
        #endregion

        #region DELETE
            [HttpDelete]
            public async Task<IActionResult> DeleteBranch (int id)
            {
                //Authentication Test
                if (HttpContext.Session.GetString("UserLevel") != adminLevel)
                {
                    return Unauthorized("Deletion attempted by non-admin!");
                }

                var _result = await context.Branches.FindAsync(id);
                if (_result == null) return NotFound();

                // Archive rather than delete: the branch's employees, stock and orders stay intact
                _result.IsArchived = true;
                await context.SaveChangesAsync();

                return NoContent();
            }
        #endregion
    }
}