<center> <h1>Bookmark Manager</h1> </center>

<img width="1383" alt="Dark Mode" src="https://github.com/user-attachments/assets/b0e63daf-2b16-4ddb-9b64-7c8a9c8417fa" />
<img width="1382" alt="Light Mode" src="https://github.com/user-attachments/assets/e611c328-cc6a-4ae7-b8d0-b41ebb48f549" />

<h2>Setup</h2>

1. Login/SignUp to supabase
2. Run the below code in supabase SQL Editor
   ```
    -- Create bookmarks table
    CREATE TABLE bookmarks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      image_url TEXT,
      site_name TEXT,
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      fts tsvector  -- Change to a normal column
    );
    
    -- Create index for faster searches
    CREATE INDEX bookmarks_url_idx ON bookmarks (url);
    CREATE INDEX bookmarks_created_at_idx ON bookmarks (created_at);
    CREATE INDEX bookmarks_fts_idx ON bookmarks USING GIN (fts);
    
    -- Function to update the fts column
    CREATE OR REPLACE FUNCTION update_bookmarks_fts() 
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.fts := to_tsvector('english', coalesce(NEW.title, '') || ' ' || 
                                 coalesce(NEW.description, '') || ' ' || 
                                 coalesce(array_to_string(NEW.tags, ' '), ''));
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Trigger to update fts on insert and update
    CREATE TRIGGER trigger_update_bookmarks_fts
    BEFORE INSERT OR UPDATE ON bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_bookmarks_fts();
    
    -- Function to update the updated_at column
    CREATE OR REPLACE FUNCTION update_modified_column() 
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Trigger to update timestamp
    CREATE TRIGGER update_bookmarks_updated_at
    BEFORE UPDATE ON bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

   ```

3. Now create a .env file in the codebase and add below three (remove the quotes while entering the details)

```
SUPABASE_URL= "Enter your supabase URL"
SUPABASE_ANON_KEY= "Enter your supabase ANON KEY"
PORT= "PORT number" (you can set to whichever port you like to, for example: 3000)
```

4. Next run ``` npm install ``` in your terminal
5. Later, run ``` npm start ```
6. Finally, open your browser and type in ```localhost:3000``` (if you have used a different port number, then type in that number instead of 3000)

<h2>Extensions</h2>

1. To use extension, open your browser and go to _Manage Extensions_
2. Check the ```Developer Mode```
3. Next, click on ```Load Unpacked``` and select the extension folder from the project folder and now your extension has been added successfully
4. Now you can jist visit any website, click on the extension and edit to different title, description or even add tags and save...

<h2>IF YOU WANT TO KEEP USING THE BOOKMARKS ALL THE TIME, THEN YOU  NEED TO EITHER HOST THE SERVER BY YOURSELF OR JUST START THE SERVER BY TYPING "npm start" EVERYTIME</h2>
