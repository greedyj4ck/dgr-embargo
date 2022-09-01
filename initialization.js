Hooks.on("init", () => {
  game.settings.register("dgr-embargo", "initialized", {
    name: "Initialization",
    scope: "world",
    config: false,
    default: false,
    type: Boolean,
  });

  game.settings.registerMenu("dgr-embargo", "init-dialog", {
    name: "DGR Embargo Initialization",
    label: "Initialize",
    hint: "This will import the content from the Degenesis Embargo Adventure Module",
    type: DGREmbargoInitWrapper,
    restricted: true,
  });
});

Hooks.on("ready", () => {
  if (!game.settings.get("dgr-embargo", "initialized") && game.user.isGM) {
    new DGREmbargoInitialization().render(true);
  }
});




    
    
   
 


class DGREmbargoInitWrapper extends FormApplication {
  render() {
    new DGREmbargoInitialization().render(true);
  }
}

class DGREmbargoInitialization extends Dialog {
  constructor() {
    super({
      title: "Degenesis Rebirth Embargo Initialization",
      content: `<p class="notes">Initialize DGR Embargo Module?<br><br>This will import all Actors, Items, Journals, and Scenes into your world, sort them into folders, and place map pins</p>
            <ul>
            <li>X Actors</li>
            <li>Y Journal Entries</li>
            <li>Z Items</li>
            <li>A Scenes</li>
            <li>B Folders organizing the above</li>
            </ul>
            `,

      buttons: {
        initialize: {
          label: "Initialize",
          callback: async () => {
            game.settings.set("dgr-embargo", "initialized", true);
            await new DGREmbargoInitialization().initialize();
            ui.notifications.notify("Initialization Complete");
          },
        },
        no: {
          label: "No",
          callback: () => {
            game.settings.set("dgr-embargo", "initialized", true);
            ui.notifications.notify("Skipped Initialization.");
          },
        },
      },
    });

    this.folders = {
      Scene: {},
      Item: {},
      Actor: {},
      JournalEntry: {},
    };
    this.SceneFolders = {};
    this.ActorFolders = {};
    this.ItemFolders = {};
    this.JournalEntryFolders = {};
    this.journals = {};
    this.actors = {};
    this.scenes = {};
    this.moduleKey = "dgr-embargo";
  }

  async initialize() {
    return new Promise((resolve) => {
      fetch(`modules/${this.moduleKey}/initialization.json`)
        .then(async (r) => r.json())
        .then(async (json) => {
          
          let createdFolders = await Folder.create(json);
          
          for (let folder of createdFolders)
            this.folders[folder.type][folder.name] = folder;

          for (let folderType in this.folders) {
            for (let folder in this.folders[folderType]) {
              let parent = this.folders[folderType][folder].getFlag(
                this.moduleKey,
                "initialization-parent"
              );
              if (parent) {
                let parentId = this.folders[folderType][parent]._id;
                await this.folders[folderType][folder].update({
                  parent: parentId,
                });
              }
            }
          }

        // Initialize Journals
        await this.initializeEntities();

        // Initialize Scenes
        await this.initializeScenes();

        // Initialize Actors
        await this.initializeActors();
          resolve();
        });
    });
  }

  async initializeEntities() {
    let journalPack = `${this.moduleKey}.dgr-embargo-journals`;
    let journalGamePack = await game.packs.get(journalPack).migrate()
    let journalPackContent = await journalGamePack .getDocuments();

    journalPackContent.forEach((entity) => {
      let entityObject = entity.toObject();

      entityObject.folder = game.folders.find(
        (folder) => folder.name === "EMBARGO"
      ).id;

      // Now create that entry
      JournalEntry.create(entityObject);
    });

    // Initialise other entities (items, actors) here
  }

  // Init scenes here
  async initializeScenes() {
    let scenesPack = `${this.moduleKey}.dgr-embargo-scenes`;
    let scenesGamePack =  await game.packs.get(scenesPack).migrate()
    let scenesPackContent = await scenesGamePack.getDocuments();

    console.log(scenesPackContent);

    scenesPackContent.forEach((entity) => {
      let entityObject = entity.toObject();

      if (entityObject.name.includes("(I)"))
        entityObject.folder = game.folders.find(
          (folder) => folder.name === "EMBARGO SCENES"
        ).id;
      if (entityObject.name.includes("(ML)"))
        entityObject.folder = game.folders.find(
          (folder) => folder.name === "MAPS (LABELS)"
        ).id;
      if (entityObject.name.includes("(M)"))
        entityObject.folder = game.folders.find(
          (folder) => folder.name === "MAPS (NO LABELS)"
        ).id;

      console.log(`Creating Scene ${entityObject.name}`);
      // Now create that scene and the thumbnail
      Scene.create(entityObject).then(async (scene) => {
        let thumb = await scene.createThumbnail();
        scene.update({ thumb: thumb.thumb });
      });
    });
  }

  // Init actors here
  async initializeActors() {
    let actorsPack = `${this.moduleKey}.dgr-embargo-actors`;
    let actorsGamePack =  await game.packs.get(actorsPack).migrate()
    let actorsPackContent = await actorsGamePack.getDocuments();

    console.log(actorsPackContent);

    actorsPackContent.forEach((entity) => {
      let entityObject = entity.toObject();

      entityObject.folder = game.folders.find(
        (folder) => folder.name === "EMBARGO CHARACTERS"
      ).id;

      console.log(`Creating Actor ${entityObject.name}`);

      Actor.create(entityObject);
    });
  }
}



// Helper function to merging journal files to single object

function JournalMerge(foldername){

  const folderName = foldername; // Change this.
  const folder = game.folders.find(f => {
    return (f.name === folderName) && (f.type === "JournalEntry");
  });
  if ( !folder ) return;
  const sort = folder.sorting === "m"
    ? SidebarDirectory._sortStandard
    : SidebarDirectory._sortAlphabetical;
  const contents = folder.contents.sort(sort);
  const pages = contents.flatMap((entry, i) => {
    const pages = [];
    // Preserve sort order in the folder.
    let sort = (i + 1) * 200_000;
    const textPage = entry.pages.find(p => p.type === "text")?.toObject();
    const imagePage = entry.pages.find(p => p.type === "image")?.toObject();
    if ( textPage ) {
      textPage.title.show = true;
      textPage.sort = sort;
      pages.push(textPage);
      sort -= 100_000;
    }
    if ( imagePage ) {
      imagePage.sort = sort;
      pages.push(imagePage);
    }
    return pages;
  });
  JournalEntry.implementation.create({
    pages,
    name: folder.name,
    folder: folder.folder?.id
  });
  };
  
  
