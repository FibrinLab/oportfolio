-- Fix: the immutability guard referenced NEW.status/NEW.version in a single
-- boolean expression, which fails on tables without those columns (and on
-- DELETE, which has no NEW at all). Nest the checks so those fields are only
-- touched for UPDATEs of framework_release itself.
CREATE OR REPLACE FUNCTION reject_published_release_mutation() RETURNS trigger AS $$
DECLARE
  release_id uuid;
  release_status release_status;
BEGIN
  IF TG_TABLE_NAME = 'framework_release' THEN
    release_id := OLD.id;
  ELSIF TG_TABLE_NAME = 'cross_mapping' THEN
    release_id := OLD.source_release_id;
  ELSIF TG_TABLE_NAME = 'external_node' THEN
    SELECT ef.framework_release_id INTO release_id
      FROM external_framework ef WHERE ef.id = OLD.external_framework_id;
  ELSIF TG_TABLE_NAME = 'domain_delivery_method' THEN
    SELECT d.framework_release_id INTO release_id
      FROM domain d WHERE d.id = OLD.domain_id;
  ELSE
    release_id := OLD.framework_release_id;
  END IF;

  SELECT fr.status INTO release_status FROM framework_release fr WHERE fr.id = release_id;

  IF release_status = 'published' THEN
    -- The only permitted change to a published release row is a lifecycle
    -- status transition (published -> superseded/retired).
    IF TG_TABLE_NAME = 'framework_release' AND TG_OP = 'UPDATE' THEN
      IF NEW.status IN ('superseded', 'retired') AND NEW.version = OLD.version THEN
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION 'published framework release content is immutable (ADR-001)';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
