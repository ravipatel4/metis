class Metis
  class Upload < Sequel::Model
    many_to_one :bucket

    def to_hash
      [ :project_name, :file_name, :author, :current_byte_position, :next_blob_size, :next_blob_hash ].map do |s|
        [ s, send(s) ]
      end.to_h
    end

    def to_json
      to_hash.to_json
    end

    def partial_location
      ::File.expand_path(::File.join(
        Metis.instance.project_path(project_name),
        'uploads',
        Metis::File.safe_file_name("#{metis_uid}-#{file_name}")
      ))
    end

    def delete_partial!
      if ::File.exists?(partial_location)
        ::File.delete(partial_location)
      end
    end

    def append_blob(blob_path)
      # use cat to avoid reading file
      %x{ cat #{blob_path} >> "#{partial_location}" }

      self.update(
        current_byte_position: ::File.size(partial_location)
      )
    end

    def file
      @file ||= Metis::File.find(
        project_name: project_name,
        file_name: file_name,
        bucket: bucket
      )
    end

    def folder
      @folder ||= Metis::File.find(
        project_name: project_name,
        file_name: folder_name,
        is_folder: true,
        bucket: bucket
      )
    end

    def folder_name
      @folder_name ||= Metis::File.folder_name(file_name)
    end

    def can_place?
      # the file exists and is read-only
      return false if file && file.read_only?

      # a folder_name is specified but no folder exists
      return false if folder_name && (!folder || folder.read_only?)

      # you can place the file
      return true
    end

    def finish!
      file = Metis::File.find_or_create(
        project_name: project_name,
        file_name: file_name,
        bucket: bucket
      ) do |f|
        f.author = author
      end
      file.folder = folder
      file.author = author
      file.save
      file.set_file_data(partial_location)
    end

    def complete?
      file_size == ::File.size(partial_location)
    end

    def blob_valid?(next_blob_path)
      # next_blob_hash and _size are the expected
      # content hash and size of the blob

      return (
        Metis::File.md5(next_blob_path) == next_blob_hash &&
        ::File.size(next_blob_path) == next_blob_size
      )
    end
  end
end
