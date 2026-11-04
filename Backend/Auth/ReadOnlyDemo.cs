using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace Artifax.Auth
{
    public static class Roles
    {
        public const string Admin = "Admin";
        public const string Employee = "Employee";
        // A public, read-only account for people evaluating the app: can sign in and view, cannot change anything
        public const string Demo = "Demo";
    }

    // Part of the global fallback policy: the demo role may only read (GET/HEAD/OPTIONS).
    // Sign-in, 2FA and logout are [AllowAnonymous], so they are not affected.
    public class ReadOnlyDemoRequirement : IAuthorizationRequirement
    {
    }

    public class ReadOnlyDemoHandler : AuthorizationHandler<ReadOnlyDemoRequirement>
    {
        protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, ReadOnlyDemoRequirement requirement)
        {
            var method = (context.Resource as HttpContext)?.Request.Method;
            var isRead = method != null && (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method));

            if (context.User.IsInRole(Roles.Demo) && !isRead)
                context.Fail();
            else
                context.Succeed(requirement);

            return Task.CompletedTask;
        }
    }

    // Gives the demo account's refused writes a readable message instead of an empty 403
    public class ReadOnlyDemoResultHandler : IAuthorizationMiddlewareResultHandler
    {
        private readonly AuthorizationMiddlewareResultHandler _default = new();

        public async Task HandleAsync(RequestDelegate next, HttpContext context, AuthorizationPolicy policy, PolicyAuthorizationResult authorizeResult)
        {
            if (authorizeResult.Forbidden && context.User.IsInRole(Roles.Demo))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "The demo account is read-only, so changes are disabled." });
                return;
            }

            await _default.HandleAsync(next, context, policy, authorizeResult);
        }
    }
}
