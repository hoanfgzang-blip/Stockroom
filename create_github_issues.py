import json
import urllib.request
import urllib.error
import ssl

# Configuration
REPO_OWNER = "hoanfgzang-blip"
REPO_NAME = "WMS-"
API_BASE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}"

# SSL Context to prevent cert errors in some environments
ssl_context = ssl._create_unverified_context()

def make_request(url, data=None, token=None, method="GET"):
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "WMS-Issue-Creator"
    }
    if token:
        headers["Authorization"] = f"token {token}"
    
    req_data = json.dumps(data).encode("utf-8") if data else None
    
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, context=ssl_context) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        print(f"HTTP Error {e.code}: {e.reason}")
        print(f"Details: {error_msg}")
        return e.code, None
    except Exception as e:
        print(f"Error making request: {str(e)}")
        return 500, None

def create_milestone(title, description, due_on, token):
    url = f"{API_BASE_URL}/milestones"
    data = {
        "title": title,
        "description": description,
        "due_on": due_on,
        "state": "open"
    }
    print(f"Creating Milestone: {title}...")
    status, response = make_request(url, data, token, "POST")
    if status == 201:
        print(f"Successfully created milestone! ID: {response['number']}")
        return response['number']
    else:
        print(f"Failed to create milestone: {title}")
        return None

def create_issue(title, body, milestone_number, token):
    url = f"{API_BASE_URL}/issues"
    data = {
        "title": title,
        "body": body,
    }
    if milestone_number:
        data["milestone"] = milestone_number
        
    print(f"Creating Issue: {title}...")
    status, response = make_request(url, data, token, "POST")
    if status == 201:
        print(f"Successfully created issue! Link: {response['html_url']}")
        return True
    else:
        print(f"Failed to create issue: {title}")
        return False

def main():
    print("====================================================")
    print(" WMS GitHub Milestones & Issues Creator ")
    print("====================================================")
    print(f"Target Repository: {REPO_OWNER}/{REPO_NAME}")
    print("\nTo create milestones and issues, you need a GitHub Personal Access Token (PAT).")
    print("Generate one at: https://github.com/settings/tokens (Classic token with 'repo' scope)")
    
    token = input("\nEnter your GitHub PAT: ").strip()
    if not token:
        print("Error: Personal Access Token is required.")
        return

    # 1. Define Milestones (Due dates represented in ISO 8601 format)
    milestones_data = [
        {
            "title": "Milestone 1: Database & Identity Foundations (Week 1)",
            "description": "Establish a secure, version-controlled database schema and ensure authorized staff roles.",
            "due_on": "2026-06-17T17:00:00Z"
        },
        {
            "title": "Milestone 2: Inbound Stock Operations (Week 2)",
            "description": "Handle incoming goods receipts, barcode scanners integration, and layout capacity checks.",
            "due_on": "2026-06-24T17:00:00Z"
        },
        {
            "title": "Milestone 3: Outbound Picking & Security (Week 3)",
            "description": "Manage outbound holds, physical picking path navigation guides, and gate seal security checks.",
            "due_on": "2026-07-01T17:00:00Z"
        },
        {
            "title": "Milestone 4: Quality Control & Discrepancy Workflows (Week 4)",
            "description": "Handle defect quarantines, physical stock shortages, and cycle recount tickets.",
            "due_on": "2026-07-08T17:00:00Z"
        }
    ]

    # Create Milestones and map to their online numbers
    milestone_mapping = {}
    for m in milestones_data:
        number = create_milestone(m["title"], m["description"], m["due_on"], token)
        if number:
            milestone_mapping[m["title"]] = number

    # 2. Define Issues
    issues_data = [
        # Milestone 1
        {
            "title": "[M1] Configure Entity Framework Core Migrations & SQL Database",
            "body": "### Objective\nTransition the database creation from `EnsureCreated` to code-first migrations.\n\n### Tasks\n- [ ] Create initial migration `InitialCreate`.\n- [ ] Setup development connection string in `appsettings.json`.\n- [ ] Auto-apply database migrations on startup in Production.",
            "milestone": "Milestone 1: Database & Identity Foundations (Week 1)"
        },
        {
            "title": "[M1] Implement Authentication & Role-based Authorization for Warehouse Staff",
            "body": "### Objective\nReplace static user ids with secure Blazor Identity or OpenID login sessions.\n\n### Tasks\n- [ ] Add Blazor Authentication configurations.\n- [ ] Define User roles: WarehouseManager, Picker, and Security.\n- [ ] Restrict UI layouts and action handlers based on roles.",
            "milestone": "Milestone 1: Database & Identity Foundations (Week 1)"
        },
        # Milestone 2
        {
            "title": "[M2] Implement Barcode Scanner Integration on Inbound Receipt UI",
            "body": "### Objective\nAllow operators to scan item barcodes or type SKU codes on WarehouseImportExport page to add items.\n\n### Tasks\n- [ ] Capture keypress Enter event on barcode text box.\n- [ ] Query product database via `InventoryService.GetProductByBarcodeAsync`.\n- [ ] Append scanned items dynamically in the UI list.",
            "milestone": "Milestone 2: Inbound Stock Operations (Week 2)"
        },
        {
            "title": "[M2] Wire Inbound Transaction Form to Backend InboundService",
            "body": "### Objective\nSave scanned items into database inventory tables on transaction process submit.\n\n### Tasks\n- [ ] Bind Supplier selections dropdown to Suppliers DB list.\n- [ ] Call `InboundService.ProcessInboundReceiptAsync` on submission.\n- [ ] Recalculate and update `Location.CurrentCapacity` values.",
            "milestone": "Milestone 2: Inbound Stock Operations (Week 2)"
        },
        # Milestone 3
        {
            "title": "[M3] Implement Timed Inventory Hold Expiration Background Service",
            "body": "### Objective\nRelease stock reservations for Draft shipments exceeding the 12-hour limit.\n\n### Tasks\n- [ ] Create a Hosted Background Worker executing periodically.\n- [ ] Call `OutboundService.ReleaseExpiredHoldsAsync` every 30 minutes.\n- [ ] Free reserved stock values and flag orders as Cancelled.",
            "milestone": "Milestone 3: Outbound Picking & Security (Week 3)"
        },
        {
            "title": "[M3] Create Outbound Picking Route Guide UI",
            "body": "### Objective\nDevelop a dedicated component for pickers displaying optimized physical routes.\n\n### Tasks\n- [ ] Fetch sorted routes from `OutboundService.GetOptimizedPickingRouteAsync`.\n- [ ] Display step-by-step navigation instructions: Zone -> Aisle -> Shelf -> Qty.\n- [ ] Add barcode scanning check to verify correct item SKU.",
            "milestone": "Milestone 3: Outbound Picking & Security (Week 3)"
        },
        {
            "title": "[M3] Build Gate Security Verification Screen",
            "body": "### Objective\nDesign a portal for security guards to check truck seal numbers at checkout.\n\n### Tasks\n- [ ] Create guard checkpoint check form.\n- [ ] Validate door physical seal matches database record.\n- [ ] Mark outbound shipment as Completed in database and log action.",
            "milestone": "Milestone 3: Outbound Picking & Security (Week 3)"
        },
        # Milestone 4
        {
            "title": "[M4] Defect Reporting & Active Quarantine Service Integration",
            "body": "### Objective\nEnable picking staff to report damaged items on-the-fly and find replacements.\n\n### Tasks\n- [ ] Implement 'Report Damage' button on picking screen.\n- [ ] Reduce available stock from shelf location using `OutboundService.ReportDefectiveItemAsync`.\n- [ ] Auto-suggest nearest alternative slot holding same product.",
            "milestone": "Milestone 4: Quality Control & Discrepancy Workflows (Week 4)"
        },
        {
            "title": "[M4] Physical Discrepancy Audits and Shortage Correction Flow",
            "body": "### Objective\nHandle stock shortages and queue automatic recounting tasks.\n\n### Tasks\n- [ ] Trigger recount ticket when stock is reported missing twice at same location.\n- [ ] Adjust sales order quantities downward.\n- [ ] Write alert entry in `AuditLogs` to flag required recount.",
            "milestone": "Milestone 4: Quality Control & Discrepancy Workflows (Week 4)"
        }
    ]

    print("\n----------------------------------------------------")
    print("Creating Issues...")
    print("----------------------------------------------------")
    success_count = 0
    for issue in issues_data:
        m_title = issue["milestone"]
        m_number = milestone_mapping.get(m_title)
        
        success = create_issue(issue["title"], issue["body"], m_number, token)
        if success:
            success_count += 1

    print("\n====================================================")
    print(f"Task Completed. Created {len(milestone_mapping)} Milestones and {success_count}/{len(issues_data)} Issues.")
    print("====================================================")

if __name__ == "__main__":
    main()
